# Google OAuth2 Setup (one-time)

SchengenShuffler uses the **Google Data Portability API** to fetch your Maps Timeline directly — no manual export needed.

## Steps

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a new project (e.g. `SchengenShuffler`)
3. **Enable APIs:**
   - Search for "Data Portability API" → Enable
4. **Create OAuth2 credentials:**
   - APIs & Services → Credentials → Create Credentials → OAuth 2.0 Client ID
   - Application type: **Web application**
   - Name: anything
   - Authorized redirect URIs: `http://localhost:3001/api/auth/google/callback`
   - Save → copy **Client ID** and **Client Secret**
5. **OAuth consent screen:**
   - Set to **External** (testing)
   - Add your own Google account email as a test user
   - Scopes: add `dataportability.maps.timeline`

## Usage

Paste your Client ID and Client Secret into the app's "Connect with Google" form. The app will open Google's OAuth consent screen, then automatically fetch and process your timeline.

The archive generation typically takes 30–120 seconds.
