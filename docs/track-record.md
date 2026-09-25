# Out-of-Sample Track Record (2024–2025 Holdout)

> Regenerable: `npm run track-record`. Trained on 660 full-finance films released ≤2023; tested on 69 films released 2024–2025 that the model never saw. Fixture: `src/generated/track-record.json`.

## Headline (n=69)

| Metric | Model | Naive baseline |
|---|---|---|
| Accuracy | 20.3% [12.5–31.2] | always-flop 81.2%, band-median 42% |
| Greenlight precision | 13.5% [5.9–28] | base hit rate 11.2% |
| Greenlight recall | 55.6% | — |
| F1 | 21.7% | — |
| GL calls | 37 (5 hits of 9 total) | — |
| RMSE (normalized multiple) | 1.346 | band-median 1.32 |

## Calibration — the financier's question

Of films the model scored "high probability", what fraction actually succeeded?

| Predicted bucket | n | Hits | Observed hit rate [95% CI] |
|---|---|---|---|
| P75+ (high) | 55 | 5 | 9.1% [3.9–19.6] |
| P60-74 | 14 | 4 | 28.6% [11.7–54.6] |
| P40-59 | 0 | 0 | 0% [0–100] |
| P<40 (low) | 0 | 0 | 0% [0–100] |

## Per-film record (every number traces to a film row)

| Film | Year | Budget | Actual | Predicted verdict | Score (Pctl) | Norm × | Hit? |
|---|---|---|---|---|---|---|---|
| Emergency (`BOLLY_2025_1590_emergency`) | 2025 | ₹60Cr | FLOP | GREENLIGHT | 24.5 (P95) | 0.15× | no |
| Azaad (`BOLLY_2025_1591_azaad`) | 2025 | ₹80Cr | FLOP | CONDITIONAL | 22.3 (P72) | 0.05× | no |
| Sky Force (`BOLLY_2025_1595_sky_force`) | 2025 | ₹160Cr | BELOW_AVG | GREENLIGHT | 24.6 (P95) | 0.56× | no |
| Deva (`BOLLY_2025_1598_deva`) | 2025 | ₹50Cr | FLOP | CONDITIONAL | 23.8 (P90) | 0.42× | no |
| Loveyapa (`BOLLY_2025_1599_loveyapa`) | 2025 | ₹60Cr | FLOP | GREENLIGHT | 24.5 (P95) | 0.06× | no |
| Chhaava (`BOLLY_2025_1604_chhaava`) | 2025 | ₹90Cr | BLOCKBUSTER | GREENLIGHT | 24 (P95) | 3.63× | yes |
| Crazxy (`BOLLY_2025_1608_crazxy`) | 2025 | ₹4.4Cr | BELOW_AVG | CONDITIONAL | 21.4 (P60) | 0.72× | no |
| The Diplomat (`BOLLY_2025_1612_the_diplomat`) | 2025 | ₹20Cr | BELOW_AVG | GREENLIGHT | 22.4 (P72) | 0.9× | no |
| Sikandar (`BOLLY_2025_1620_sikandar`) | 2025 | ₹200Cr | FLOP | GREENLIGHT | 25.6 (P98) | 0.47× | no |
| Jaat (`BOLLY_2025_1621_jaat`) | 2025 | ₹100Cr | BELOW_AVG | GREENLIGHT | 25.2 (P98) | 0.63× | no |
| Kesari Chapter 2 (`BOLLY_2025_1623_kesari_chapter_2`) | 2025 | ₹150Cr | FLOP | CONDITIONAL | 25.7 (P98) | 0.5× | no |
| Phule (`BOLLY_2025_1628_phule`) | 2025 | ₹30Cr | FLOP | CONDITIONAL | 21.9 (P60) | 0.08× | no |
| Raid 2 (`BOLLY_2025_1629_raid_2`) | 2025 | ₹120Cr | BREAK_EVEN | CONDITIONAL | 23.4 (P90) | 1.07× | no |
| Bhool Chuk Maaf (`BOLLY_2025_1634_bhool_chuk_maaf`) | 2025 | ₹50Cr | BELOW_AVG | GREENLIGHT | 24.2 (P95) | 0.74× | no |
| Housefull 5 (`BOLLY_2025_1641_housefull_5`) | 2025 | ₹225Cr | BELOW_AVG | CONDITIONAL | 24.3 (P95) | 0.55× | no |
| Sitaare Zameen Par (`BOLLY_2025_1642_sitaare_zameen_par`) | 2025 | ₹122Cr | BREAK_EVEN | GREENLIGHT | 25.6 (P98) | 1.15× | no |
| Maa (`BOLLY_2025_1644_maa`) | 2025 | ₹65Cr | FLOP | GREENLIGHT | 30.1 (P98) | 0.33× | no |
| Metro... In Dino (`BOLLY_2025_1646_metro_in_dino`) | 2025 | ₹47Cr | BELOW_AVG | CONDITIONAL | 22.5 (P82) | 0.69× | no |
| Saiyaara (`BOLLY_2025_1651_saiyaara`) | 2025 | ₹45Cr | BLOCKBUSTER | CONDITIONAL | 22.1 (P72) | 5.28× | yes |
| Mahavatar Narsimha (`BOLLY_2025_1656_mahavatar_narsimha`) | 2025 | ₹20Cr | BLOCKBUSTER | CONDITIONAL | 22.4 (P72) | 5.08× | yes |
| Son of Sardaar 2 (`BOLLY_2025_1661_son_of_sardaar_2`) | 2025 | ₹150Cr | FLOP | CONDITIONAL | 25.2 (P98) | 0.21× | no |
| War 2 (`BOLLY_2025_1665_war_2`) | 2025 | ₹300Cr | FLOP | GREENLIGHT | 25.1 (P98) | 0.48× | no |
| Param Sundari (`BOLLY_2025_1667_param_sundari`) | 2025 | ₹60Cr | BELOW_AVG | GREENLIGHT | 24.9 (P95) | 0.59× | no |
| Baaghi 4 (`BOLLY_2025_1669_baaghi_4`) | 2025 | ₹80Cr | FLOP | GREENLIGHT | 23.7 (P90) | 0.34× | no |
| The Bengal Files (`BOLLY_2025_1670_the_bengal_files`) | 2025 | ₹50Cr | FLOP | CONDITIONAL | 23.8 (P90) | 0.13× | no |
| Jolly LLB 3 (`BOLLY_2025_1679_jolly_llb_3`) | 2025 | ₹120Cr | BELOW_AVG | CONDITIONAL | 24.8 (P95) | 0.73× | no |
| Sunny Sanskari Ki Tulsi Kumari (`BOLLY_2025_1683_sunny_sanskari_ki_tulsi_kumari`) | 2025 | ₹80Cr | BELOW_AVG | GREENLIGHT | 24.3 (P95) | 0.51× | no |
| Thamma (`BOLLY_2025_1687_thamma`) | 2025 | ₹145Cr | BELOW_AVG | CONDITIONAL | 24.8 (P95) | 0.62× | no |
| Ek Deewane Ki Deewaniyat (`BOLLY_2025_1688_ek_deewane_ki_deewaniyat`) | 2025 | ₹25Cr | HIT | GREENLIGHT | 23.1 (P82) | 1.52× | yes |
| Haq (`BOLLY_2025_1691_haq`) | 2025 | ₹40Cr | FLOP | CONDITIONAL | 21.5 (P60) | 0.29× | no |
| De De Pyaar De 2 (`BOLLY_2025_1695_de_de_pyaar_de_2`) | 2025 | ₹150Cr | FLOP | CONDITIONAL | 24 (P95) | 0.37× | no |
| 120 Bahadur (`BOLLY_2025_1699_120_bahadur`) | 2025 | ₹80Cr | FLOP | GREENLIGHT | 23.3 (P90) | 0.1× | no |
| Mastiii 4 (`BOLLY_2025_1700_mastiii_4`) | 2025 | ₹40Cr | FLOP | GREENLIGHT | 22.8 (P82) | 0.16× | no |
| Tere Ishk Mein (`BOLLY_2025_1701_tere_ishk_mein`) | 2025 | ₹85Cr | BELOW_AVG | GREENLIGHT | 24.4 (P95) | 0.72× | no |
| Dhurandhar (`BOLLY_2025_1704_dhurandhar`) | 2025 | ₹250Cr | BLOCKBUSTER | GREENLIGHT | 25.3 (P98) | 2.74× | yes |
| Kis Kisko Pyaar Karoon 2 (`BOLLY_2025_1705_kis_kisko_pyaar_karoon_2`) | 2025 | ₹35Cr | FLOP | GREENLIGHT | 24.1 (P95) | 0.17× | no |
| Tu Meri Main Tera Main Tera Tu Meri (`BOLLY_2025_1709_tu_meri_main_tera_main_tera_tu_meri`) | 2025 | ₹90Cr | FLOP | GREENLIGHT | 25.5 (P98) | 0.22× | no |
| Merry Christmas (`BOLLY_2024_1472_merry_christmas`) | 2024 | ₹60Cr | FLOP | CONDITIONAL | 22.4 (P72) | 0.18× | no |
| Main Atal Hoon (`BOLLY_2024_1473_main_atal_hoon`) | 2024 | ₹20Cr | FLOP | GREENLIGHT | 22.3 (P72) | 0.15× | no |
| Fighter (`BOLLY_2024_1474_fighter`) | 2024 | ₹250Cr | BELOW_AVG | GREENLIGHT | 29.6 (P98) | 0.7× | no |
| Teri Baaton Mein Aisa Uljha Jiya (`BOLLY_2024_1475_teri_baaton_mein_aisa_uljha_jiya`) | 2024 | ₹75Cr | BELOW_AVG | GREENLIGHT | 23.2 (P82) | 0.73× | no |
| Crakk (`BOLLY_2024_1481_crakk`) | 2024 | ₹45Cr | FLOP | CONDITIONAL | 21.3 (P60) | 0.16× | no |
| Article 370 (`BOLLY_2024_1482_article_370`) | 2024 | ₹20Cr | HIT | CONDITIONAL | 21.6 (P60) | 1.87× | yes |
| Laapataa Ladies (`BOLLY_2024_1485_laapataa_ladies`) | 2024 | ₹4Cr | HIT | CONDITIONAL | 22.1 (P72) | 1.8× | yes |
| Shaitaan (`BOLLY_2024_1490_shaitaan`) | 2024 | ₹60Cr | BREAK_EVEN | GREENLIGHT | 30 (P98) | 1.44× | no |
| Yodha (`BOLLY_2024_1493_yodha`) | 2024 | ₹55Cr | FLOP | CONDITIONAL | 24 (P95) | 0.39× | no |
| Swatantrya Veer Savarkar (`BOLLY_2024_1497_swatantrya_veer_savarkar`) | 2024 | ₹20Cr | BELOW_AVG | GREENLIGHT | 24.1 (P95) | 0.53× | no |
| Bade Miyan Chote Miyan (`BOLLY_2024_1503_bade_miyan_chote_miyan`) | 2024 | ₹350Cr | FLOP | GREENLIGHT | 24.3 (P95) | 0.14× | no |
| Maidaan (`BOLLY_2024_1504_maidaan`) | 2024 | ₹235Cr | FLOP | CONDITIONAL | 25.3 (P98) | 0.15× | no |
| Ruslaan (`BOLLY_2024_1511_ruslaan`) | 2024 | ₹25Cr | FLOP | CONDITIONAL | 22.2 (P72) | 0.04× | no |
| Srikanth (`BOLLY_2024_1513_srikanth`) | 2024 | ₹35Cr | BELOW_AVG | CONDITIONAL | 23.2 (P82) | 0.74× | no |
| Mr. & Mrs. Mahi (`BOLLY_2024_1517_mr_mrs_mahi`) | 2024 | ₹40Cr | BELOW_AVG | CONDITIONAL | 24 (P95) | 0.53× | no |
| Savi (`BOLLY_2024_1518_savi`) | 2024 | ₹20Cr | FLOP | CONDITIONAL | 22.1 (P72) | 0.3× | no |
| Munjya (`BOLLY_2024_1524_munjya`) | 2024 | ₹30Cr | HIT | GREENLIGHT | 24.4 (P95) | 1.81× | yes |
| Chandu Champion (`BOLLY_2024_1525_chandu_champion`) | 2024 | ₹70Cr | BELOW_AVG | GREENLIGHT | 24.5 (P95) | 0.52× | no |
| Kill (`BOLLY_2024_1535_kill`) | 2024 | ₹40Cr | FLOP | CONDITIONAL | 24.2 (P95) | 0.48× | no |
| Sarfira (`BOLLY_2024_1537_sarfira`) | 2024 | ₹80Cr | FLOP | GREENLIGHT | 24.7 (P95) | 0.15× | no |
| Bad Newz (`BOLLY_2024_1539_bad_newz`) | 2024 | ₹80Cr | BELOW_AVG | GREENLIGHT | 24.5 (P95) | 0.59× | no |
| Auron Mein Kahan Dum Tha (`BOLLY_2024_1541_auron_mein_kahan_dum_tha`) | 2024 | ₹100Cr | FLOP | GREENLIGHT | 24.3 (P95) | 0.07× | no |
| Ulajh (`BOLLY_2024_1542_ulajh`) | 2024 | ₹35Cr | FLOP | CONDITIONAL | 23.9 (P90) | 0.13× | no |
| Khel Khel Mein (`BOLLY_2024_1547_khel_khel_mein`) | 2024 | ₹100Cr | FLOP | CONDITIONAL | 24.5 (P95) | 0.3× | no |
| Vedaa (`BOLLY_2024_1548_vedaa`) | 2024 | ₹60Cr | FLOP | GREENLIGHT | 24.8 (P95) | 0.18× | no |
| Stree 2 (`BOLLY_2024_1549_stree_2`) | 2024 | ₹50Cr | BLOCKBUSTER | GREENLIGHT | 24.3 (P95) | 7.18× | yes |
| Yudhra (`BOLLY_2024_1559_yudhra`) | 2024 | ₹50Cr | FLOP | CONDITIONAL | 23.2 (P82) | 0.09× | no |
| Jigra (`BOLLY_2024_1567_jigra`) | 2024 | ₹80Cr | FLOP | GREENLIGHT | 24.5 (P95) | 0.28× | no |
| Bhool Bhulaiyaa 3 (`BOLLY_2024_1574_bhool_bhulaiyaa_3`) | 2024 | ₹150Cr | BREAK_EVEN | CONDITIONAL | 23.5 (P90) | 1.49× | no |
| Singham Again (`BOLLY_2024_1575_singham_again`) | 2024 | ₹350Cr | BELOW_AVG | GREENLIGHT | 25.2 (P98) | 0.53× | no |
| The Sabarmati Report (`BOLLY_2024_1578_the_sabarmati_report`) | 2024 | ₹50Cr | FLOP | CONDITIONAL | 23.4 (P90) | 0.26× | no |
| Baby John (`BOLLY_2024_1586_baby_john`) | 2024 | ₹180Cr | FLOP | GREENLIGHT | 25.3 (P98) | 0.17× | no |

## Caveats

- n=69 is small: calibration buckets carry wide confidence intervals. 2024–2025 follows the hardest walk-forward folds (2022/2024) — this is the toughest possible holdout, post-regime-change years.
- Concept scores (clarity/novelty) are estimated from verdicts and pre-sale rights from budget — the CSV contains neither (documented limitation, same inputs as the walk-forward benchmark).
- Imputed rows (236) are excluded from both training and the holdout.
