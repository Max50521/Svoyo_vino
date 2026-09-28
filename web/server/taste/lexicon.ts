// Dictionary and level words. Arrays, not objects: iteration order is fixed.
import type { FamilyId, Level, ScaleId } from './types'

export const RULES_VERSION = 'taste-rules@1'

// Russian endings. "о(?=-)" covers the first part of compounds: "фруктово-цветочный".
const N = '(?:а|я|у|ю|ью|ом|ем|ой|ей|е|ы|и|ов|ев|ам|ям|ами|ями|ах|ях)?'
const A = '(?:ый|ий|ой|ая|яя|ое|ее|ые|ие|ого|его|ому|ему|ым|им|ую|юю|ых|их|ыми|ими|ом|ем|о(?=-))'
const W = '[а-я]*' // any ending inside multi-word patterns

const n = (stem: string, endings = N) => stem + endings
const a = (stem: string) => stem + A

export interface NoteTerm {
  id: string
  label: string
  family: FamilyId
  patterns: string[]
  generic?: boolean
  /** Counts only next to a note word ("тона дуба"), not in "выдержано в дубе". */
  needsNoteContext?: boolean
}

const t = (id: string, label: string, family: FamilyId, patterns: string[], extra: Partial<NoteTerm> = {}): NoteTerm =>
  ({ id, label, family, patterns, ...extra })

export const FAMILIES: Array<{ id: FamilyId, label: string }> = [
  { id: 'citrus', label: 'Цитрусы' },
  { id: 'orchard', label: 'Сад и косточковые' },
  { id: 'red_berry', label: 'Красные ягоды' },
  { id: 'dark_berry', label: 'Тёмные ягоды и слива' },
  { id: 'tropical', label: 'Тропические фрукты' },
  { id: 'dried', label: 'Сухофрукты и варенье' },
  { id: 'floral', label: 'Цветы' },
  { id: 'herbal', label: 'Травы и зелень' },
  { id: 'spice', label: 'Специи' },
  { id: 'nut', label: 'Орехи' },
  { id: 'wood', label: 'Дерево и выдержка' },
  { id: 'sweet', label: 'Сладкие ассоциации' },
  { id: 'mineral', label: 'Минералы, земля и дым' },
]

export const NOTES: NoteTerm[] = [
  // citrus
  t('lemon', 'Лимон', 'citrus', [n('лимон'), a('лимонн')]),
  t('lime', 'Лайм', 'citrus', [n('лайм')]),
  t('grapefruit', 'Грейпфрут', 'citrus', [n('грейпфрут'), a('грейпфрутов')]),
  t('orange', 'Апельсин', 'citrus', [n('апельсин'), a('апельсинов')]),
  t('mandarin', 'Мандарин', 'citrus', [n('мандарин'), a('мандаринов')]),
  t('bergamot', 'Бергамот', 'citrus', [n('бергамот')]),
  t('pomelo', 'Помело', 'citrus', ['помело']),
  t('zest', 'Цедра', 'citrus', [n('цедр')]),
  t('citrus', 'Цитрусы', 'citrus', [n('цитрус'), a('цитрусов')], { generic: true }),
  // orchard & stone fruit
  t('green_apple', 'Зелёное яблоко', 'orchard', [`зелен${W}\\s+${n('яблок')}`]),
  t('apple', 'Яблоко', 'orchard', [n('яблок', '(?:о|а|у|ом|е|и|ами|ах)?'), a('яблочн')]),
  t('pear', 'Груша', 'orchard', [n('груш'), a('грушев'), n('дюшес')]),
  t('gooseberry', 'Крыжовник', 'orchard', [n('крыжовник')]),
  t('sea_buckthorn', 'Облепиха', 'orchard', [n('облепих'), a('облепихов')]),
  t('quince', 'Айва', 'orchard', [n('айв'), a('айвов')]),
  t('peach', 'Персик', 'orchard', [n('персик'), a('персиков')]),
  t('nectarine', 'Нектарин', 'orchard', [n('нектарин')]),
  t('apricot', 'Абрикос', 'orchard', [n('абрикос'), a('абрикосов')]),
  t('alycha', 'Алыча', 'orchard', [n('алыч'), a('алычов')]),
  t('white_plum', 'Белая слива', 'orchard', [`бел${W}\\s+${n('слив')}`]),
  // "сбор винограда", "сорт винограда" are technology; only "ноты винограда" is an aroma.
  t('grape', 'Виноград', 'orchard', [n('виноград'), a('виноградн')], { needsNoteContext: true }),
  t('fruit', 'Фрукты', 'orchard', [n('фрукт'), a('фруктов')], { generic: true }),
  // red berries
  t('cherry', 'Вишня', 'red_berry', [n('вишн'), a('вишнев')]),
  t('sweet_cherry', 'Черешня', 'red_berry', [n('черешн'), a('черешнев')]),
  t('strawberry', 'Клубника', 'red_berry', [n('клубник'), a('клубничн')]),
  t('wild_strawberry', 'Земляника', 'red_berry', [n('земляник'), a('земляничн')]),
  t('raspberry', 'Малина', 'red_berry', [n('малин'), a('малинов')]),
  t('cranberry', 'Клюква', 'red_berry', [n('клюкв'), a('клюквенн')]),
  t('lingonberry', 'Брусника', 'red_berry', [n('брусник'), a('брусничн')]),
  t('red_currant', 'Красная смородина', 'red_berry', [`красн${W}\\s+${n('смородин')}`]),
  t('cornel', 'Кизил', 'red_berry', [n('кизил'), a('кизилов')]),
  t('pomegranate', 'Гранат', 'red_berry', [n('гранат'), a('гранатов')]),
  t('barberry', 'Барбарис', 'red_berry', [n('барбарис')]),
  t('rosehip', 'Шиповник', 'red_berry', [n('шиповник')]),
  t('red_berries', 'Красные ягоды', 'red_berry', [`красн${W}\\s+${n('ягод')}`], { generic: true }),
  t('garden_berries', 'Садовые ягоды', 'red_berry', [`садов${W}\\s+${n('ягод')}`], { generic: true }),
  t('forest_berries', 'Лесные ягоды', 'red_berry', [`лесн${W}\\s+${n('ягод')}`], { generic: true }),
  t('berries', 'Ягоды', 'red_berry', [n('ягод'), a('ягодн')], { generic: true }),
  // dark fruit
  t('black_currant', 'Чёрная смородина', 'dark_berry', [`черн${W}\\s+${n('смородин')}`]),
  t('currant', 'Смородина', 'dark_berry', [n('смородин'), a('смородинов')]),
  t('blackberry', 'Ежевика', 'dark_berry', [n('ежевик'), a('ежевичн')]),
  t('blueberry', 'Черника', 'dark_berry', [n('черник'), a('черничн')]),
  t('bilberry', 'Голубика', 'dark_berry', [n('голубик')]),
  t('mulberry', 'Шелковица', 'dark_berry', [n('шелковиц'), n('тутовник')]),
  t('elderberry', 'Бузина', 'dark_berry', [n('бузин')]),
  t('sloe', 'Тёрн', 'dark_berry', ['терн(?:а|ом|у)?', a('тернов')]),
  t('aronia', 'Черноплодная рябина', 'dark_berry', [`черноплодн${W}(?:\\s+${n('рябин')})?`]),
  t('plum', 'Слива', 'dark_berry', [n('слив'), a('сливов')]),
  t('dark_berries', 'Тёмные ягоды', 'dark_berry', [`(?:черн|темн)${W}\\s+${n('ягод')}`], { generic: true }),
  // tropical
  t('pineapple', 'Ананас', 'tropical', [n('ананас'), a('ананасов')]),
  t('mango', 'Манго', 'tropical', ['манго']),
  t('passion_fruit', 'Маракуйя', 'tropical', [n('маракуй'), n('пассифлор')]),
  t('lychee', 'Личи', 'tropical', ['личи']),
  t('banana', 'Банан', 'tropical', [n('банан'), a('бананов')]),
  t('papaya', 'Папайя', 'tropical', [n('папай')]),
  t('guava', 'Гуава', 'tropical', [n('гуав')]),
  t('kiwi', 'Киви', 'tropical', ['киви']),
  t('melon', 'Дыня', 'tropical', [n('дын'), a('дынн')]),
  t('tropical', 'Тропические фрукты', 'tropical', [`(?:тропическ|экзотическ)${W}(?:\\s+${n('фрукт')})?`], { generic: true }),
  // dried fruit & jam
  t('prune', 'Чернослив', 'dried', [n('чернослив')]),
  t('dried_apricot', 'Курага', 'dried', [n('кураг')]),
  t('raisin', 'Изюм', 'dried', [n('изюм')]),
  t('fig', 'Инжир', 'dried', [n('инжир'), a('инжиров')]),
  t('date', 'Финик', 'dried', [n('финик')]),
  t('dried_cherry', 'Вяленая вишня', 'dried', [`(?:вялен|сушен|сушен)${W}\\s+${n('вишн')}`]),
  t('dried_fruit', 'Сухофрукты', 'dried', [n('сухофрукт'), `(?:вялен|сушен)${W}\\s+${n('фрукт')}`], { generic: true }),
  t('candied', 'Цукаты', 'dried', [n('цукат')]),
  t('jam', 'Варенье', 'dried', [n('варень'), n('конфитюр'), n('джем'), n('мармелад'), n('пастил')]),
  // floral
  t('white_flowers', 'Белые цветы', 'floral', [`бел${W}\\s+(?:цвет(?:ы|ов|ами|ах|ам)|${a('цветочн')})`]),
  t('rose', 'Роза', 'floral', ['роз(?:а|ы|у|ой|ами|ах)?']),
  t('violet', 'Фиалка', 'floral', [n('фиалк')]),
  t('acacia', 'Акация', 'floral', [n('акаци')]),
  t('linden', 'Липа', 'floral', ['лип(?:а|ы|е|ой|у)', a('липов')]),
  t('jasmine', 'Жасмин', 'floral', [n('жасмин')]),
  t('lavender', 'Лаванда', 'floral', [n('лаванд')]),
  t('chamomile', 'Ромашка', 'floral', [n('ромашк')]),
  t('peony', 'Пион', 'floral', [n('пион')]),
  t('iris', 'Ирис', 'floral', ['ирис(?:ы|ов|ами)']),
  t('honeysuckle', 'Жимолость', 'floral', [n('жимолост')]),
  t('flowers', 'Цветы', 'floral', ['цвет(?:ы|ов|ами|ах|ам)', a('цветочн')], { generic: true }),
  // herbal
  t('lemongrass', 'Лимонная трава', 'herbal', [`лимонн${W}\\s+${n('трав')}`]),
  t('bay_leaf', 'Лавровый лист', 'herbal', [`лавров${W}\\s+${n('лист')}`]),
  t('rhubarb', 'Ревень', 'herbal', ['ревен(?:ь|я|ем|ю)']),
  t('cut_grass', 'Скошенная трава', 'herbal', [`скошенн${W}\\s+${n('трав')}`]),
  t('green_pepper', 'Зелёный перец', 'herbal', [`зелен${W}\\s+(?:перц${W}|перец)`]),
  t('currant_leaf', 'Лист смородины', 'herbal', [`лист${W}\\s+(?:черн${W}\\s+)?${n('смородин')}`]),
  t('mint', 'Мята', 'herbal', ['мят(?:а|ы|е|ой|у)', a('мятн')]),
  t('rosemary', 'Розмарин', 'herbal', [n('розмарин')]),
  t('thyme', 'Чабрец', 'herbal', [n('чабрец'), n('чабрец'), n('тимьян')]),
  t('sage', 'Шалфей', 'herbal', [n('шалфе', '(?:й|я|ем|ю)')]),
  t('eucalyptus', 'Эвкалипт', 'herbal', [n('эвкалипт')]),
  t('basil', 'Базилик', 'herbal', [n('базилик')]),
  t('fennel', 'Фенхель', 'herbal', [n('фенхел', '(?:ь|я|ем|ю)')]),
  t('wormwood', 'Полынь', 'herbal', ['полын(?:ь|и|ью)']),
  t('pine', 'Хвоя', 'herbal', ['хво(?:я|и|ей|ю)', a('хвойн')]),
  t('herbs', 'Травы', 'herbal', ['трав(?:а|ы|е|у|ой|ами|ах|ам)?', a('травянист'), a('травян')], { generic: true }),
  // spice
  t('black_pepper', 'Чёрный перец', 'spice', [`черн${W}\\s+(?:перц${W}|перец)`]),
  t('nutmeg', 'Мускатный орех', 'spice', [`мускатн${W}\\s+${n('орех')}`]),
  t('pepper', 'Перец', 'spice', ['перец', n('перц'), a('перечн')]),
  t('clove', 'Гвоздика', 'spice', [n('гвоздик')]),
  t('cinnamon', 'Корица', 'spice', [n('кориц')]),
  t('anise', 'Анис', 'spice', [n('анис')]),
  t('cardamom', 'Кардамон', 'spice', [n('кардамон')]),
  t('ginger', 'Имбирь', 'spice', ['имбир(?:ь|я|ем|ю)', a('имбирн')]),
  t('licorice', 'Лакрица', 'spice', [n('лакриц'), n('солодк')]),
  t('saffron', 'Шафран', 'spice', [n('шафран')]),
  t('spices', 'Пряности', 'spice', [n('пряност'), a('прян'), n('специ')], { generic: true }),
  // nuts
  t('walnut', 'Грецкий орех', 'nut', [`грецк${W}\\s+${n('орех')}`]),
  t('almond', 'Миндаль', 'nut', ['миндал(?:ь|я|ем|ю)', a('миндальн')]),
  t('hazelnut', 'Фундук', 'nut', [n('фундук'), `лесн${W}\\s+${n('орех')}`]),
  t('pistachio', 'Фисташка', 'nut', [n('фисташк')]),
  t('nuts', 'Орехи', 'nut', [n('орех'), a('орехов')], { generic: true }),
  // wood & ageing
  t('oak', 'Дуб', 'wood', ['дуб(?:а|е|ом)?', a('дубов')], { needsNoteContext: true }),
  t('cedar', 'Кедр', 'wood', [n('кедр'), a('кедров')]),
  t('tobacco', 'Табак', 'wood', [n('табак'), a('табачн')]),
  t('leather', 'Кожа', 'wood', ['кож(?:а|и|е|у|ей)', a('кожан')]),
  t('coffee', 'Кофе', 'wood', ['кофе', a('кофейн')]),
  t('resin', 'Смола', 'wood', [n('смол')]),
  t('woody', 'Древесные тона', 'wood', [a('древесн')], { generic: true }),
  // sweet associations
  t('honey', 'Мёд', 'sweet', ['мед(?:а|у|ом)?', a('медов')]),
  t('vanilla', 'Ваниль', 'sweet', ['ванил(?:ь|и|ью)', a('ванильн')]),
  t('caramel', 'Карамель', 'sweet', ['карамел(?:ь|и|ью)', a('карамельн')]),
  t('chocolate', 'Шоколад', 'sweet', [n('шоколад'), a('шоколадн')]),
  t('cocoa', 'Какао', 'sweet', ['какао']),
  t('candy', 'Леденцы', 'sweet', [n('леденц'), a('леденцов')]),
  t('pastry', 'Выпечка', 'sweet', [n('выпечк'), n('бриош', '(?:ь|и|ью)'), n('тост'), a('тостов'), `хлебн${W}\\s+${n('корочк')}`]),
  t('toffee', 'Ирис', 'sweet', [n('ириск'), n('нуг'), n('марципан'), n('пралине', '')]),
  // mineral, earth, smoke
  t('mineral', 'Минеральность', 'mineral', [n('минерал'), a('минеральн'), n('минеральност')]),
  t('chalk', 'Мел', 'mineral', ['мел(?:а|ом|у)?', a('мелов')]),
  t('flint', 'Кремень', 'mineral', ['кремень', n('кремн'), a('кремнист')]),
  t('smoke', 'Дым', 'mineral', ['дым(?:а|ом|у|ок|ка|ком|ке)?', a('дымн'), n('копченост'), a('копчен')]),
  t('petrol', 'Петроль', 'mineral', [n('петрол'), n('бензин')]),
  t('salt', 'Солёные ноты', 'mineral', [a('солен'), n('солоноватост')]),
  t('earth', 'Земля и грибы', 'mineral', [a('землист'), n('гриб'), a('грибн'), n('трюфел', '(?:ь|я|ем|ю|и)'), n('подлеск')]),
  t('graphite', 'Графит', 'mineral', [n('графит')]),
]

/** Words that make an oak mention an aroma note. */
export const NOTE_CONTEXT = /^(нот|тон|оттенк|оттен|аромат|привкус|нюанс|намек|штрих|акцент|полутон)/
export const NEGATIONS = new Set(['без', 'не', 'нет', 'ни'])
/** A note word followed by these is about soil or vessels: "меловых почвах", "дубовой бочке". */
export const NOT_A_NOTE_NEXT = /^(почв|склон|грунт|террас|бочк|бочек|бочон|емкост|резервуар|сорт|лоз)/

// ---- scales ---------------------------------------------------------------

export interface LevelWord { stem: string, level: Level, label: string }
export interface DescriptorWord { stem: string, label: string }
export interface ScaleLexicon {
  id: ScaleId
  /** Noun stems of the feature: "кислотн", "танин". */
  nouns: RegExp
  levels: LevelWord[]
  descriptors: DescriptorWord[]
  levelLabels: Record<Level, string>
  /** Nominative endings of a predicate after the noun: "кислотность высокая", "танины выражены". */
  predicate: RegExp
}

export const ACIDITY: ScaleLexicon = {
  id: 'acidity',
  nouns: /^(кислотн|кислинк)/,
  levels: [
    { stem: 'невысок', level: 1, label: 'низкая' },
    { stem: 'низк', level: 1, label: 'низкая' },
    { stem: 'слаб', level: 1, label: 'низкая' },
    { stem: 'мягк', level: 1, label: 'низкая' },
    { stem: 'умеренн', level: 2, label: 'средняя' },
    { stem: 'средн', level: 2, label: 'средняя' },
    { stem: 'высок', level: 3, label: 'высокая' },
    { stem: 'ярк', level: 3, label: 'высокая' },
    { stem: 'выраженн', level: 3, label: 'высокая' },
    { stem: 'бодр', level: 3, label: 'высокая' },
    { stem: 'хрустящ', level: 3, label: 'высокая' },
    { stem: 'остр', level: 3, label: 'высокая' },
    { stem: 'звонк', level: 3, label: 'высокая' },
    { stem: 'энергичн', level: 3, label: 'высокая' },
    { stem: 'интенсивн', level: 3, label: 'высокая' },
  ],
  descriptors: [
    { stem: 'жив', label: 'живая' },
    { stem: 'свеж', label: 'свежая' },
    { stem: 'освежающ', label: 'освежающая' },
    { stem: 'сочн', label: 'сочная' },
    { stem: 'гармоничн', label: 'гармоничная' },
    { stem: 'сбалансированн', label: 'сбалансированная' },
    { stem: 'деликатн', label: 'деликатная' },
    { stem: 'приятн', label: 'приятная' },
    { stem: 'нежн', label: 'нежная' },
    { stem: 'тонк', label: 'тонкая' },
    { stem: 'элегантн', label: 'элегантная' },
    { stem: 'минеральн', label: 'минеральная' },
    { stem: 'фруктов', label: 'фруктовая' },
    { stem: 'хорош', label: 'хорошая' },
  ],
  levelLabels: { 1: 'низкая', 2: 'средняя', 3: 'высокая' },
  predicate: /(ая|яя)$/,
}

export const TANNIN: ScaleLexicon = {
  id: 'tannin',
  nouns: /^(танин|терпкост)/,
  levels: [
    { stem: 'легк', level: 1, label: 'лёгкие' },
    { stem: 'низк', level: 1, label: 'лёгкие' },
    { stem: 'слаб', level: 1, label: 'лёгкие' },
    { stem: 'едва', level: 1, label: 'лёгкие' },
    { stem: 'умеренн', level: 2, label: 'умеренные' },
    { stem: 'средн', level: 2, label: 'умеренные' },
    { stem: 'выраженн', level: 3, label: 'выраженные' },
    { stem: 'высок', level: 3, label: 'выраженные' },
    { stem: 'мощн', level: 3, label: 'выраженные' },
    { stem: 'плотн', level: 3, label: 'выраженные' },
    { stem: 'крепк', level: 3, label: 'выраженные' },
    { stem: 'сильн', level: 3, label: 'выраженные' },
    { stem: 'терпк', level: 3, label: 'выраженные' },
    { stem: 'жестк', level: 3, label: 'выраженные' },
    { stem: 'цепк', level: 3, label: 'выраженные' },
    { stem: 'насыщенн', level: 3, label: 'выраженные' },
  ],
  descriptors: [
    { stem: 'бархатист', label: 'бархатистые' },
    { stem: 'мягк', label: 'мягкие' },
    { stem: 'округл', label: 'округлые' },
    { stem: 'шелковист', label: 'шелковистые' },
    { stem: 'зрел', label: 'зрелые' },
    { stem: 'сочн', label: 'сочные' },
    { stem: 'нежн', label: 'нежные' },
    { stem: 'гладк', label: 'гладкие' },
    { stem: 'тонк', label: 'тонкие' },
    { stem: 'элегантн', label: 'элегантные' },
    { stem: 'деликатн', label: 'деликатные' },
    { stem: 'благородн', label: 'благородные' },
    { stem: 'интегрированн', label: 'интегрированные' },
    { stem: 'гармоничн', label: 'гармоничные' },
    { stem: 'сбалансированн', label: 'сбалансированные' },
    { stem: 'структурированн', label: 'структурированные' },
    { stem: 'шершав', label: 'шершавые' },
  ],
  levelLabels: { 1: 'лёгкие', 2: 'умеренные', 3: 'выраженные' },
  predicate: /(ые|ие|ны|ки)$/,
}

export const BODY: ScaleLexicon = {
  id: 'body',
  nouns: /^(тел(о|а|у|ом|е)?$)/,
  levels: [
    { stem: 'легк', level: 1, label: 'лёгкое' },
    { stem: 'средн', level: 2, label: 'среднее' },
    { stem: 'полн', level: 3, label: 'полное' },
    { stem: 'плотн', level: 3, label: 'полное' },
    { stem: 'насыщенн', level: 3, label: 'полное' },
    { stem: 'объемн', level: 3, label: 'полное' },
  ],
  descriptors: [],
  levelLabels: { 1: 'лёгкое', 2: 'среднее', 3: 'полное' },
  predicate: /(ое|ее)$/,
}

/** Whole-word body expressions without the noun "тело". */
export const BODY_PHRASES: Array<{ re: RegExp, level: Level, rule: string }> = [
  { re: /(?<![а-я])легкотел[а-я]*/g, level: 1, rule: 'body.light-bodied' },
  { re: /(?<![а-я])среднетел[а-я]*/g, level: 2, rule: 'body.medium-bodied' },
  { re: /(?<![а-я])полнотел[а-я]*/g, level: 3, rule: 'body.full-bodied' },
  { re: /(?<![а-я])средн[а-я]*\s+полнот[а-я]*/g, level: 2, rule: 'body.medium-fullness' },
  // "вкус полный", "полный вкус" — fullness of the palate.
  { re: /(?<![а-я])вкус[а-я]*(?:\s+[а-я-]+,?){0,3}\s+полн(?:ый|ым)(?![а-я])/g, level: 3, rule: 'body.full-palate' },
  { re: /(?<![а-я])полн(?:ый|ым|ого)\s+вкус[а-я]*/g, level: 3, rule: 'body.full-palate' },
  // "лёгкое вино", "вино лёгкое" — not "лёгкий вкус" or "лёгкие оттенки".
  { re: /(?<![а-я])легк(?:ое|ого|им)\s+(?:[а-я]+(?:ое|ого|им)\s+){0,2}вин[оа](?![а-я])/g, level: 1, rule: 'body.light-wine' },
  { re: /(?<![а-я])вино\s+легк(?:ое)(?![а-я])/g, level: 1, rule: 'body.light-wine' },
]

// Sweetness. Longest phrases are listed first; overlaps keep the longest.
export interface SweetTerm { re: string, label: string, level: Level, sparklingOnly?: boolean }
export const SWEET_STILL: SweetTerm[] = [
  { re: 'полусух[а-я]*|semi[\\s-]?dry|medium[\\s-]?dry', label: 'Полусухое', level: 2 },
  { re: 'полусладк[а-я]*|semi[\\s-]?sweet|medium[\\s-]?sweet', label: 'Полусладкое', level: 2 },
  { re: 'dry', label: 'Сухое', level: 1 },
  { re: 'sweet', label: 'Сладкое', level: 3 },
  { re: 'сух(?:ое|ой|ая|ие|ого|ых|им)', label: 'Сухое', level: 1 },
  { re: '(?:сладк(?:ое|ий|ая|ие|ого|ых)|десертн[а-я]*|ликерн[а-я]*)', label: 'Сладкое', level: 3 },
]
export const SWEET_SPARKLING: SweetTerm[] = [
  { re: '(?:брют|brut)\\s+(?:натюр|nature|зеро|zero)|нон\\s+дозаж|non\\s+dosage|pas\\s+dose', label: 'Брют натюр', level: 1 },
  { re: '(?:экстра|extra)[\\s-]+(?:брют|brut)', label: 'Экстра брют', level: 1 },
  { re: 'брют|brut', label: 'Брют', level: 1 },
  { re: '(?:экстра|extra)[\\s-]+(?:сух[а-я]*|драй|dry)', label: 'Экстра сухое', level: 2 },
  { re: 'полусух[а-я]*|demi[\\s-]sec', label: 'Полусухое', level: 2 },
  { re: 'сух(?:ое|ой|ая|ие|ого|ых|им)|\\bsec\\b', label: 'Сухое', level: 2 },
  { re: 'полусладк[а-я]*', label: 'Полусладкое', level: 3 },
  { re: 'сладк(?:ое|ий|ая|ие|ого|ых)|doux|dolce', label: 'Сладкое', level: 3 },
]
export const SPARKLING_RE = /(?<![а-яa-z])(игрист[а-я]*|брют|brut|пет-?нат|pet-?nat|петнат|шампанск[а-я]*|спуманте|spumante|креман|cremant|франчакорт[а-я]*|просекко|prosecco|кава|шампенуаз|шарма)(?![а-яa-z])/
