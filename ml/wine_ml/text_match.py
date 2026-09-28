"""Re-rank visual candidates by the text read on the label (OCR).

CV finds the right label series; within a series wines differ by words
(sugar, colour, grape, year) that CV barely sees. For each candidate we check
how much of its name/winery is confirmed by OCR (recall) and how much of the
informative OCR text it explains (precision), then add a precision-weighted
text agreement score (F-beta, beta=0.5) to the visual
score and subtract a penalty for contradictions (e.g. label says "брют",
candidate is "полусладкое").

Details that matter on real shelf photos:
- OCR misreads letters ("МУСКАТЕАЬ", "БЕАЫЙ") -> fuzzy token match;
- labels are in Cyrillic or Latin, slugs are transliterated -> everything is
  compared in Latin transliteration;
- neighbour bottles are read too -> OCR tokens are weighted by distance from
  the frame centre (the scanned label is usually centred);
- words shared by all candidates ("Массандра") do not discriminate -> IDF
  weights computed within the candidate list.
"""
from __future__ import annotations

import math
import re
from functools import lru_cache

_TRANSLIT = dict(zip(
    "абвгдеёжзийклмнопрстуфхцчшщъыьэюя",
    ["a", "b", "v", "g", "d", "e", "e", "zh", "z", "i", "y", "k", "l", "m", "n", "o", "p",
     "r", "s", "t", "u", "f", "h", "ts", "ch", "sh", "sch", "", "y", "", "e", "yu", "ya"],
))

FUZZY_MIN = 0.8        # normalized Levenshtein similarity for a token match
CENTER_SIGMA_X = 0.2   # OCR token weight falls off with horizontal distance from the centre
CENTER_SIGMA_Y = 0.35

# Values that contradict each other within a group (colour, sugar).
GROUPS: dict[str, dict[str, set[str]]] = {
    "color": {
        "white": {"belyy", "beloe", "belaya", "belogo", "white", "blanc", "bianco"},
        "red": {"krasnoe", "krasnyy", "krasnaya", "red", "rosso", "rouge"},
        "rose": {"rozovoe", "rozovyy", "rozovaya", "rose", "roze", "rosato"},
        "orange": {"oranzhevoe", "oranzhevyy", "orange"},
    },
    "sugar": {
        "brut": {"bryut", "brut"},
        "dry": {"suhoe", "suhoy", "sukhoe", "dry", "secco"},
        "semi_dry": {"polusuhoe", "polusuhoy", "demisec"},
        "semi_sweet": {"polusladkoe", "polusladkiy", "semisweet"},
        "sweet": {"sladkoe", "sladkiy", "sweet", "dolce"},
    },
}
YEAR_RE = re.compile(r"^20[0-3]\d$")


def translit(text: str) -> str:
    return "".join(_TRANSLIT.get(c, c) for c in text.lower())


def tokens(text: str | None) -> list[str]:
    """Latin tokens of length >= 3 (plus 4-digit years); '0,75' -> '075'."""
    if not text:
        return []
    s = re.sub(r"(?<=\d)[.,](?=\d)", "", translit(text))
    return [t for t in re.findall(r"[a-z0-9]+", s) if len(t) >= 3]


def _lev(a: str, b: str) -> int:
    if len(a) < len(b):
        a, b = b, a
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        cur = [i]
        for j, cb in enumerate(b, 1):
            cur.append(min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (ca != cb)))
        prev = cur
    return prev[-1]


@lru_cache(maxsize=65536)
def fuzzy_sim(a: str, b: str) -> float:
    if a == b:
        return 1.0
    if not a or not b or abs(len(a) - len(b)) > max(len(a), len(b)) * (1 - FUZZY_MIN):
        return 0.0
    return 1 - _lev(a, b) / max(len(a), len(b))


def _group_values(toks: list[str]) -> dict[str, set[str]]:
    found: dict[str, set[str]] = {}
    for group, values in GROUPS.items():
        for value, words in values.items():
            if any(fuzzy_sim(t, w) >= FUZZY_MIN for t in toks for w in words):
                found.setdefault(group, set()).add(value)
    years = {t for t in toks if YEAR_RE.match(t)}
    if years:
        found["year"] = years
    return found


def conflicts(ocr_tokens: list[str], candidate_tokens: list[str]) -> int:
    """Number of groups (colour, sugar, year) where the label and the candidate disagree."""
    seen, cand = _group_values(ocr_tokens), _group_values(candidate_tokens)
    return sum(1 for g, v in seen.items() if g in cand and not (v & cand[g]))


def _ocr_weighted_tokens(ocr: list[dict]) -> list[tuple[str, float]]:
    out = []
    for item in ocr:
        w = float(item.get("conf", 1.0))
        if "cx" in item:
            dx, dy = item["cx"] - 0.5, item.get("cy", 0.5) - 0.5
            w *= math.exp(-dx * dx / (2 * CENTER_SIGMA_X ** 2) - dy * dy / (2 * CENTER_SIGMA_Y ** 2))
        ts = label_tokens(item["text"], repair=True)
        out += [(t, w) for t in ts]
        # OCR splits spaced lettering inside a single text box (e.g. MUS CAT).
        # Joined variants are only useful when supported by a catalog token.
        for n in range(2, min(8, len(ts)) + 1):
            out += [(canonical_token(''.join(ts[i:i+n])), w * .95)
                    for i in range(len(ts)-n+1) if 3 <= len(''.join(ts[i:i+n])) <= 24]
    return out


ALIASES = {
    'muscat':'muskat', 'cabernet':'kaberne', 'sauvignon':'sovinon',
    'sovinon':'sovinon', 'sovinion':'sovinon', 'merlot':'merlo',
    'chardonnay':'shardone', 'pinot':'pino', 'riesling':'risling',
}
STOP_WORDS = {'vino','wine','winery','vineyard','vineyards','vinodelnya',
              'semeynaya','semeynoe','rossiyskoe','rossiyskoy','vin','dom',
              'pomeste','pomestye','usadba'}

def canonical_token(t: str) -> str:
    t = t.replace('shch','sch').replace('shh','sch').replace('kh','h')
    return ALIASES.get(t,t)

def label_tokens(text: str | None, repair: bool = False) -> list[str]:
    """Keep short fragments until joining; canonicalize common grape spellings."""
    if not text:
        return []
    # OCR frequently mixes visually identical Cyrillic and Latin characters.
    chunks=[]
    lookalikes=str.maketrans('ABCEHKMOPTXYabceopxy','АВСЕНКМОРТХУавсеорху')
    if repair and len(re.findall('[а-яА-ЯёЁ]',text)) >= 2:
        text=text.translate(lookalikes).replace('₽','Р')
    for chunk in re.findall(r'[\w]+',text):
        if re.search('[а-яА-ЯёЁ]',chunk):
            chunk=chunk.translate(lookalikes)
        chunks.extend(re.findall('[a-z0-9]+',translit(chunk)))
    return [canonical_token(t) for t in chunks]

@lru_cache(maxsize=65536)
def label_similarity(a: str, b: str) -> float:
    if a==b:
        return 1.
    # Inflected family names on a label vs the nominative catalog name.
    if len(a)>=6 and b.startswith(a) and b[len(a):] in {'ov','a','aia','y','i'}:
        return .95
    if min(len(a),len(b))>=4 and len(a)==len(b):
        return 1-_lev(a,b)/len(a)
    return fuzzy_sim(a,b)


def candidate_name_tokens(c: dict) -> list[str]:
    """What may be printed on a label: wine name, winery and grape varieties."""
    return list(dict.fromkeys(t for key in ('name','winery','grapes')
                              for t in label_tokens(c.get(key))
                              if len(t)>=3 and t not in STOP_WORDS))


def candidate_attr_tokens(c: dict) -> list[str]:
    """Attributes used for contradictions: name, category and slug (slug carries colour/sugar)."""
    return label_tokens(c.get("name")) + label_tokens(c.get("category")) + label_tokens((c.get("slug") or "").replace("-", " "))


def rerank(ocr: list[dict], candidates: list[dict], alpha: float, beta: float) -> list[dict]:
    """Candidates (dicts with 'visual' score) -> copies with 'text', 'conflicts', 'final', sorted by final."""
    ocr_toks = _ocr_weighted_tokens(ocr)
    names = [candidate_name_tokens(c) for c in candidates]
    k = len(candidates)
    df: dict[str, int] = {}
    for toks in names:
        for t in set(toks):
            df[t] = df.get(t, 0) + 1
    idf = {t: math.log((k + 1) / (d + 0.5)) for t, d in df.items()}

    # best OCR evidence for every candidate token: (similarity * OCR weight, index of OCR token)
    def evidence(t: str) -> tuple[float, int]:
        best, idx = 0.0, -1
        for i, (o, w) in enumerate(ocr_toks):
            s = label_similarity(t, o)
            threshold = .75 if min(len(t),len(o)) == 4 else FUZZY_MIN
            if s >= threshold and s * w > best:
                best, idx = s * w, i
        return best, idx

    ev = {t: evidence(t) for t in idf}
    # informative OCR tokens = those that confirm some candidate token; their weight = max idf they confirm
    informative: dict[int, float] = {}
    for t, (s, i) in ev.items():
        if i >= 0:
            informative[i] = max(informative.get(i, 0.0), idf[t] * ocr_toks[i][1])
    info_total = sum(informative.values())

    ocr_plain = [t for t, w in ocr_toks if w >= .35]
    out = []
    for c, toks in zip(candidates, names):
        total = sum(idf[t] for t in toks)
        matched = sum(idf[t] * ev[t][0] for t in toks)
        recall = matched / total if total else 0.0
        explained = sum(informative[i] for i in {ev[t][1] for t in toks} if i in informative)
        precision = min(1.0, explained / info_total) if info_total else 0.0
        # A partial label need not spell the entire catalog description. Favor
        # explaining the visible words over rewarding the shortest product name.
        text = 1.25 * recall * precision / (.25 * precision + recall) if recall + precision else 0.0
        n_conf = conflicts(ocr_plain, candidate_attr_tokens(c)) if ocr_plain else 0
        out.append({**c, "text": round(text, 4), "conflicts": n_conf,
                    "final": round(c["visual"] + alpha * text - beta * n_conf, 4)})
    return sorted(out, key=lambda c: c["final"], reverse=True)
