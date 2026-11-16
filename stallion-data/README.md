# stallion-data フォルダ

種牡馬ロスター拡張のための、データ受け渡しフォルダです。

- 調査・下書き担当（協力者側）：`PROMPT.md` の指示に従って、対象は `TARGET_LIST.md` のリストから、1バッチ10頭分の JSON ファイルを作ってチャットで渡してください。ファイル名は `stallions_add_01.json`、`stallions_add_02.json` … の連番。
- 照合・導入担当（AI）：受け取ったファイルをこのフォルダに置き、JBIS 等の原典と照合して、ゲームのデータ（`data/stallions_draft.json` と `prototype/`）に組み込みます。
- 組み込みが終わったバッチは、このフォルダのファイル名末尾を `_done` に変えるか、照合結果を `notes_XX.md` に残します。

指示プロンプトは [PROMPT.md](PROMPT.md) を見てください。
