# Sinterklaas Broadcast Control – testversie

Twee pagina's:
- `/` – broadcastscherm voor Yodeck
- `/controller` – telefooncontroller

## 1. Maak een nieuw Supabase-project
Maak een apart project aan. Bewaar Project URL, anon/public key en service_role key veilig.

## 2. Maak de tabel
Open Supabase SQL Editor en voer `schema.sql` volledig uit.
Schakel daarna `broadcast_state` in voor Database > Publications > `supabase_realtime` (Postgres Changes).

## 3. Upload de testvideo
Maak in Supabase Storage een bucket met de naam `broadcast-media`. Zet de bucket op Public.
Upload `sint-yodeck-test.mp4` (het door jou aangeleverde bestand) en kopieer de publieke URL.
De URL ziet er ongeveer zo uit:
`https://PROJECT.supabase.co/storage/v1/object/public/broadcast-media/sint-yodeck-test.mp4`

## 4. Vul config.js in
Vul `SUPABASE_URL`, `SUPABASE_ANON_KEY` en `SPECIAL_VIDEO_URL` in.
De YouTube-ID staat al ingevuld. Gebruik hier alleen de anon/public key, nooit de service-role key.

## 5. Deploy naar GitHub en Vercel
Zet de inhoud van deze map in een nieuwe GitHub-repository en importeer die repository in Vercel.

Voeg in Vercel > Project > Settings > Environment Variables toe:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `CONTROLLER_PIN`

Gebruik dezelfde Project URL als in config.js. De service-role key en controllercode blijven uitsluitend server-side.
Deploy opnieuw na het instellen van de variabelen.

## 6. Open de pagina's
- Broadcast op Yodeck: `https://JOUW-DOMEIN.vercel.app/`
- Controller op telefoon: `https://JOUW-DOMEIN.vercel.app/controller`

## Belangrijke testbeperking
De browser kan afspelen met geluid blokkeren wanneer een MP4 pas na een remote commando start. Dit hangt af van de Yodeck-browser/kioskconfiguratie. Test eerst op het daadwerkelijke scherm. De controller toont dat het commando is verstuurd; de broadcaststatus geeft de lokale afspeelstatus weer. De YouTube-player gebruikt de officiële iframe API. Laat de Yodeck-browser toe om YouTube en Supabase te bereiken.

## Eerste test
1. Open `/` op een laptop of Yodeck-scherm en laat de openhaard laden.
2. Open `/controller` op een telefoon.
3. Vul de regiecode in.
4. Druk op Start Sinterklaasvideo.
5. Controleer of de MP4 met geluid start en na circa 40 seconden de openhaard terugkomt.
6. Test ook Terug naar openhaard tijdens de MP4.

Deze eerste versie is bewust klein gehouden. Er is nog geen loginaccount, playlist of planning.
