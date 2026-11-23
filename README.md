# 半桶庸醫 QuackCheck

耐力運動之後，標出自己覺得痛的位置，整理成可以帶去見註冊物理治療師或骨科醫生的摘要。

**痛點不是診斷。** 這個程式不判斷你患了甚麼，不評病情等級，也不保證已經知道有沒有骨折或斷裂。紅旗答「是」、走不到四步，或突然啪一聲，只準備就醫（香港：999／急症室），不提供按摩、按摩槍、推拿或練習。

## 而家做到

- 3D 人體：點一下光選肌肉，雙擊搬到地下，再點就放返。要標痛先撳「標為痛點」。
- 痛史用日常講法：痛感程度、幾耐、自發／持續／偶發／按壓先痛、腫或硬結。
- 紅旗三態、下肢假設（髂脛束、臀中肌、髕股、夾脛對骨應力、跟腱、足底、深臀；下背只轉介）。
- 自我檢查在模型上用金色同箭嘴指出要輕按的位置，例如脛骨內側。
- 療法分三層：先做、可一併試（含按摩槍）、進階了解（含推拿、筋膜刀、磁叉）。紅旗未答完、骨應力線索或個人禁忌會收起相應手法。
- 紀錄只放在這部瀏覽器的 IndexedDB，可以匯出／匯入 JSON，以及下載 Markdown 摘要。

## 本地

```bash
npm install
npm test
npm run dev
```

## 參考

文獻只用來整理「值得一併討論的假設」同安全鎖，不是診斷依據。3D 模型只標位置，網格名稱不驅動診斷。

### 解剖模型（CC BY-SA 4.0）

模型是成人男性參考，來自 [Z-Anatomy](https://www.z-anatomy.com/)／[Z-Anatomy/Models-of-human-anatomy](https://github.com/Z-Anatomy/Models-of-human-anatomy)（CC BY-SA 4.0）。上游資料包括 [BodyParts3D](https://dbarchive.biosciencedbc.jp/en/bodyparts3d/desc.html)。

點選、雙擊搬開表層的互動方式參考 [hpfrei/body-anatomy-3d-viewer](https://github.com/hpfrei/body-anatomy-3d-viewer)。規格亦提過較細的 [hoik-muscle-model](https://github.com/kalibismail/gymmetry-muscle-model)（CC BY-SA 4.0）；這一版用的是 Z-Anatomy 全身模型，不是該分割檔。

### 臨床與安全

- 路跑損傷發生率與盛行率：[Kakouris et al., 2021 (PMC8500811)](https://pmc.ncbi.nlm.nih.gov/articles/PMC8500811/)
- 紅旗、Ottawa 問句、下肢鑑別：[PMC12195327](https://pmc.ncbi.nlm.nih.gov/articles/PMC12195327/)、[PMC6828998](https://pmc.ncbi.nlm.nih.gov/articles/PMC6828998/)
- 髂脛束：[StatPearls NBK542185](https://www.ncbi.nlm.nih.gov/books/NBK542185/)
- 髕股疼痛檢查：[PMC5095938](https://pmc.ncbi.nlm.nih.gov/articles/PMC5095938/)
- 轉移痛方向只取文字描述，不複製圖版：[Travell & Simons（NIH Catalog）](https://catalog.nlm.nih.gov/discovery/fulldisplay/alma9917278423406676/01NLM_INST:01NLM_INST)

### 手法、護具與教學（白名單，不是推薦購買）

- 按摩槍短期活動度，不提升肌力：[PMC10532323](https://pmc.ncbi.nlm.nih.gov/articles/PMC10532323/)、[PMC10069390](https://pmc.ncbi.nlm.nih.gov/articles/PMC10069390/)。教學清單：[Theragun How-To](https://www.youtube.com/playlist?list=PL_YMY8Wz4L_CheOFtKKYUVNgUctjfE-04)。骨應力、小腿腫熱或個人禁忌時封鎖。
- 滾筒與拉筋不優於動態熱身：[PMC11184403](https://pmc.ncbi.nlm.nih.gov/articles/PMC11184403/)
- 筋膜刀禁忌：[PMC11941819](https://pmc.ncbi.nlm.nih.gov/articles/PMC11941819/)、[PMC5039777](https://pmc.ncbi.nlm.nih.gov/articles/PMC5039777/)
- 靜態磁鐵止痛未優於安慰劑（p = 0.29）：[PMC1976658](https://pmc.ncbi.nlm.nih.gov/articles/PMC1976658/)
- 肌貼只作輔助：[PMC7349891](https://pmc.ncbi.nlm.nih.gov/articles/PMC7349891/)、[Acti-Tape 施貼方法](https://www.acti-tape.com/zh/applications)。慢性腰痛貼布研究不可外推到跑者：[PMC13565805](https://pmc.ncbi.nlm.nih.gov/articles/PMC13565805/)
- 低衝擊練習參考：[Bauerfeind Home Workouts](https://www.bauerfeind.us/workouts/)。急性期不導入箱跳、波比跳。護具結構圖鑑：[Pocket Catalog 2026](https://www.bauerfeind-group.com/fileadmin/user_upload/bf-germany_bf-international/_downloads/pocket-catalog-EN.pdf)（品牌中立，不是購買建議）
- 推拿維持「傳統」等級，只供認識手法：[中醫推拿按摩教程陳老師](https://www.youtube.com/playlist?list=PLnqTaGJrSqECVMvU4Ux0f96vawytSmwu0)。不教學頸椎快速扳動。背景：[丁氏滾法](https://www.sohu.com/a/451403837_100185418)

規格版本：半桶庸醫（QuackCheck）技術與需求規格書 v1.0.3。
