# Discord Webhook Forwarder

## 導入と実行
`npm ci`でlockfileから依存を導入し、`npm start`で起動します。隔離検証は`npm ci --ignore-scripts`と`npm test`です。従来ソースが参照するのに未宣言だったaxiosを依存へ追加しました。署名検証はNode.js標準cryptoを使うためtweetnaclは不要です。外部依存の追加はaxiosのみです。

## Discord署名（SEC-037）
既存の`DISCORD_PUBLIC_KEY`へDiscord Developer PortalのApplication Public Key（64桁hex）を設定してください。公開鍵はBot tokenとは異なります。未設定・不正形式では`POST /discord`を503で拒否し、署名を省略して処理を続行しません。healthの`GET /`だけは設定にかかわらず利用可能です。

`X-Signature-Ed25519`と`X-Signature-Timestamp`を検査し、timestamp文字列と未変換raw bodyを連結したバイト列に対してEd25519を検証します。無署名・不正署名・改ざんは401です。追加の鮮度制限として、現在時刻から±5分を超えるtimestampも拒否します（この5分は本実装の方針でありDiscordが指定する値ではありません）。ホスト時刻を同期してください。

Discord公式の根拠: https://docs.discord.com/developers/interactions/overview#validating-security-request-headers

現在のinteraction処理は定型返信のみで、未使用の送信helperを呼びません。5分内の同じ正規署名の再送はDiscordの再試行に備えて受け入れます。永続的な重複排除は追加していません。将来転送・DB更新などの副作用を追加する場合は、interaction IDに基づく冪等処理が必要です。

## 配備前確認
ユーザー回答では現在未使用のため、修正PRはdraftで保留し、本番配備しません。将来再開するときは公開鍵・本番URL・Discord側Interactions Endpoint URLの対応を確認してください。設定不足で既存interaction処理が停止するため、鍵未確認のままマージしないでください。新たな秘密キーやDB移行は不要です。実Discordの疎通は未試験です。
