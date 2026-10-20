# Eval: google/siglip2-so400m-patch14-384 (labeled, OCR rerank top-10 a=0.1 b=0.05), views: full, label_mid, label_low, label weight 0.5

Index: 2103 wines; near-duplicates (cos≥0.9): 1076; twins (cos≥0.99, excluded from the main rows): 96. Embed: 57.0 ms/img (batched).

| subset | n | Top-1 | Top-5 | Top-10 | mean margin (correct) | confident share | Top-1 when confident |
|---|---|---|---|---|---|---|---|
| all_in_catalog | 64 | 96.9% | 100.0% | 100.0% | 0.0743 | 75.0% | 0.9583 |
| all_without_twins | 61 | 96.7% | 100.0% | 100.0% | 0.0766 | 77.0% | 0.9574 |
| near_duplicates | 34 | 94.1% | 100.0% | 100.0% | 0.0585 | 70.6% | 0.9167 |
| distinct | 27 | 100.0% | 100.0% | 100.0% | 0.0979 | 85.2% | 1.0 |
| twins | 3 | 100.0% | 100.0% | 100.0% | 0.0306 | 33.3% | 1.0 |

Service answer (not_found when best visual score < 0.75):

- wines in the catalog (64): right card 89.1%, wrongly "not in catalog" 7.8%
- wines not in the catalog (33): correctly "not in catalog" 57.6%
