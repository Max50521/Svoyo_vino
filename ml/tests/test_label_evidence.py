"""General label-reading regressions, independent of the evaluation photo IDs."""
from wine_ml.text_match import rerank, candidate_name_tokens, _ocr_weighted_tokens
from wine_ml.catalog import resolve_file
from PIL import Image

def candidate(slug, name, visual=.8, **kwargs):
    return dict(slug=slug, name=name, winery='Винодельня', category='', grapes='', visual=visual, **kwargs)

def test_edge_bottle_cannot_veto_central_colour():
    ocr=[dict(text='Розовое',conf=.99,cx=.95,cy=.5)]
    cs=[candidate('white','Белое'),candidate('rose','Розовое')]
    assert next(c for c in rerank(ocr,cs,.1,.05) if c['slug']=='white')['conflicts']==0
    ocr[0]['cx']=.5
    assert next(c for c in rerank(ocr,cs,.1,.05) if c['slug']=='white')['conflicts']==1

def test_grape_identifies_same_named_series_with_spaced_latin_label():
    cs=[candidate('a','Коллекция'),candidate('b','Коллекция')]
    cs[0]['grapes']='Рислинг';cs[1]['grapes']='Мускат'
    assert rerank([dict(text='MUS CAT',conf=.99,cx=.5,cy=.5)],cs,.1,.05)[0]['slug']=='b'

def test_mixed_alphabets_and_currency_glyph_are_joined():
    tokens=dict(_ocr_weighted_tokens([dict(text='KАБ Е ₽ H Е',conf=1)]))
    assert 'kaberne' in tokens

def test_bilingual_catalog_name_is_not_repaired_as_broken_ocr():
    ts=candidate_name_tokens(dict(name='Литавщук',winery='Litavshchuk vineyards & winery'))
    assert ts==['litavschuk']

def test_distinctive_inflected_winery_beats_generic_winery_word():
    cs=[candidate('a','Мерло',.8),candidate('b','Мерло',.78)]
    cs[0]['winery']='Винодельня Берег';cs[1]['winery']='Орлов'
    assert rerank([dict(text='Винодельня Орлова',conf=.99)],cs,.1,.05)[0]['slug']=='b'

def test_four_letter_name_survives_one_ocr_substitution():
    cs=[candidate('a','Лира'),candidate('b','Звезда')]
    assert rerank([dict(text='ЛИПА',conf=.99)],cs,.1,.05)[0]['slug']=='a'

def test_raster_resolution_does_not_merge_different_small_label_text(tmp_path):
    a=Image.new('RGBA',(100,300),(80,60,40,255));a.paste((250,250,250,255),(0,180,100,260))
    b=a.copy();b.paste((0,0,0,255),(45,200,55,215))
    pa,pb=tmp_path/'a.png',tmp_path/'b.png';a.save(pa);b.save(pb)
    assert resolve_file([pa,pb])==(None,'')

def test_raster_resolution_accepts_small_compression_noise_at_full_size(tmp_path):
    pa,pb=tmp_path/'a.png',tmp_path/'b.png'
    Image.new('RGBA',(100,300),(80,60,40,255)).save(pa)
    Image.new('RGBA',(100,300),(81,61,41,255)).save(pb)
    assert resolve_file([pa,pb])==(pa,'equivalent_reencode')

def test_colour_word_read_with_a_typo_still_contradicts():
    # "траское" is how OCR read "красное" on a real shelf photo
    cs=[candidate('white','Поздний сбор, Белое'),candidate('red','Поздний сбор, Красное')]
    ocr=[dict(text='ПОЗДНИЙ СБОР',conf=.9,cx=.5,cy=.5),dict(text='траское',conf=.5,cx=.5,cy=.5)]
    out={c['slug']:c for c in rerank(ocr,cs,.1,.05)}
    assert out['white']['conflicts']==1 and out['red']['conflicts']==0

def test_distinguishing_word_decides_within_a_series():
    # same name, same winery; the grape is the only difference and outweighs a small visual lead
    cs=[candidate('riesling','Velvet Season',visual=.68),candidate('muscat','Velvet Season',visual=.653),
        candidate('icewine','Ледяное вино Мускат',visual=.64)]
    for c,g in zip(cs,('Рислинг','Мускат Оттонель','Мускат Оттонель')):c['grapes']=g
    ocr=[dict(text='VELVET',conf=.99,cx=.5,cy=.5),dict(text='SEA SON',conf=.97,cx=.5,cy=.5),
         dict(text='MUS CAT',conf=.7,cx=.5,cy=.5)]
    assert rerank(ocr,cs,.1,.05,gamma=0)[0]['slug']=='riesling'
    out=rerank(ocr,cs,.1,.05,gamma=.05)
    assert out[0]['slug']=='muscat'
    assert next(c for c in out if c['slug']=='icewine')['series']==0   # other series of the winery: no bonus

def test_series_bonus_needs_a_rival_of_the_same_series():
    cs=[candidate('a','Мерло',visual=.8),candidate('b','Каберне',visual=.79)]
    out=rerank([dict(text='МЕРЛО',conf=.99,cx=.5,cy=.5)],cs,.1,.05,gamma=.05)
    assert all(c['series']==0 for c in out)
