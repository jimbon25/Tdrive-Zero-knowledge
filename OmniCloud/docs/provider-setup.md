# Provider credential setup

This guide explains how to create credentials for the cloud providers supported by OmniCloud.

Keep this guide separate from the main `README.md` so the README stays short while provider-specific setup can stay detailed.

## Redirect URIs used by OmniCloud

Use these callback URLs while running OmniCloud locally:

| Provider | Redirect URI |
| --- | --- |
| Google Drive | `http://localhost:8787/api/accounts/google/callback` |
| OneDrive | `http://localhost:8787/api/accounts/onedrive/callback` |
| Dropbox | `http://localhost:8787/api/accounts/dropbox/callback` |
| Yandex Disk | `http://localhost:8787/api/accounts/yandex/callback` |

If you change the API port or deploy the API to another domain, update the redirect URIs in both the provider dashboard and `backend/.env`.

## Environment variables

Add the credentials to `backend/.env`:

```env
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=http://localhost:8787/api/accounts/google/callback

ONEDRIVE_CLIENT_ID=
ONEDRIVE_CLIENT_SECRET=
ONEDRIVE_TENANT_ID=common
ONEDRIVE_REDIRECT_URI=http://localhost:8787/api/accounts/onedrive/callback

DROPBOX_CLIENT_ID=
DROPBOX_CLIENT_SECRET=
DROPBOX_REDIRECT_URI=http://localhost:8787/api/accounts/dropbox/callback

YANDEX_CLIENT_ID=
YANDEX_CLIENT_SECRET=
YANDEX_REDIRECT_URI=http://localhost:8787/api/accounts/yandex/callback
```

MEGA, pCloud, and S3-compatible services do not use developer credentials in `.env`. MEGA and pCloud connect from the app UI with email/password; S3 services use per-bucket access keys entered in the form.

## Google Drive

### 1. Open Google Cloud Console

Open:

`https://console.cloud.google.com/`

Sign in with the Google account that will own the OAuth app.

### 2. Create or select a project

1. Click the project selector in the top bar.
2. Click **New Project** if you do not already have one.
3. Name it, for example `OmniCloud Local`.
4. Open the project.

### 3. Enable the Google Drive API

1. Go to **APIs & Services** → **Library**.
2. Search for **Google Drive API**.
3. Open it.
4. Click **Enable**.

### 4. Configure the OAuth consent screen

1. Go to **APIs & Services** → **OAuth consent screen**.
2. Choose **External** for personal/local use unless you are using a Google Workspace internal app.
3. Fill the required app information.
4. Add yourself as a test user if the app is in testing mode.
5. Save the consent screen.

### 5. Create OAuth client credentials

1. Go to **APIs & Services** → **Credentials**.
2. Click **Create Credentials** → **OAuth client ID**.
3. Choose **Web application**.
4. Name it, for example `OmniCloud API Local`.
5. Under **Authorized redirect URIs**, add:

   ```text
   http://localhost:8787/api/accounts/google/callback
   ```

6. Click **Create**.

### 6. Copy values into `.env`

Google shows a **Client ID** and **Client secret**.

Use them like this:

```env
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REDIRECT_URI=http://localhost:8787/api/accounts/google/callback
```

### Notes

- The redirect URI must match exactly.
- If the OAuth app is in testing mode, only test users can connect.
- Do not commit `.env`.

## OneDrive

OneDrive uses Microsoft Entra ID app registrations.

### 1. Open Microsoft Entra admin center

Open:

`https://entra.microsoft.com/`

You can also reach app registrations from Azure Portal:

`https://portal.azure.com/`

### 2. Create an app registration

1. Go to **Applications** → **App registrations**.
2. Click **New registration**.
3. Name it, for example `OmniCloud Local`.
4. For **Supported account types**, choose one of:
   - **Accounts in any organizational directory and personal Microsoft accounts** for broad local testing.
   - **Personal Microsoft accounts only** if you only need personal OneDrive accounts.
5. Under **Redirect URI**, choose **Web**.
6. Add:

   ```text
   http://localhost:8787/api/accounts/onedrive/callback
   ```

7. Click **Register**.

### 3. Copy the client ID

On the app overview page, copy:

- **Application (client) ID** → `ONEDRIVE_CLIENT_ID`
- **Directory (tenant) ID** → can be used as `ONEDRIVE_TENANT_ID`

For personal accounts and broad testing, `ONEDRIVE_TENANT_ID=common` is usually easiest.

### 4. Create a client secret

1. Open **Certificates & secrets**.
2. Click **New client secret**.
3. Add a description, for example `OmniCloud local secret`.
4. Choose an expiration.
5. Click **Add**.
6. Copy the **Value** immediately.

Use the **Value** as `ONEDRIVE_CLIENT_SECRET`, not the Secret ID.

### 5. Configure API permissions

1. Open **API permissions**.
2. Click **Add a permission**.
3. Choose **Microsoft Graph**.
4. Choose **Delegated permissions**.
5. Add file-related permissions needed by OmniCloud, such as:

   ```text
   Files.ReadWrite.All
   offline_access
   User.Read
   ```

6. Save the permissions.

### 6. Copy values into `.env`

```env
ONEDRIVE_CLIENT_ID=your_application_client_id
ONEDRIVE_CLIENT_SECRET=your_client_secret_value
ONEDRIVE_TENANT_ID=common
ONEDRIVE_REDIRECT_URI=http://localhost:8787/api/accounts/onedrive/callback
```

### Notes

- Use the client secret **Value**, not the Secret ID.
- If you use a specific tenant ID, only accounts allowed by that tenant configuration can connect.
- Some organization accounts may require admin consent.

## Dropbox

Dropbox uses an app key and app secret. In OmniCloud they map to:

- **App key** → `DROPBOX_CLIENT_ID`
- **App secret** → `DROPBOX_CLIENT_SECRET`

### 1. Open Dropbox App Console

Open:

`https://www.dropbox.com/developers/apps`

Sign in with the Dropbox account that will own the app.

### 2. Create an app

1. Click **Create app**.
2. For **Choose an API**, select **Scoped access**.
3. For access type, choose one:
   - **Full Dropbox** if OmniCloud should access the user's whole Dropbox.
   - **App folder** if OmniCloud should only access a dedicated app folder.
4. Give the app a unique name, for example `OmniCloud Local`.
5. Click **Create app**.

### 3. Add redirect URI

1. Open the app **Settings** tab.
2. Find **OAuth 2** → **Redirect URIs**.
3. Add:

   ```text
   http://localhost:8787/api/accounts/dropbox/callback
   ```

4. Save or click **Add**.

### 4. Copy app key and app secret

In the **Settings** tab:

- Copy **App key** into `DROPBOX_CLIENT_ID`.
- Click **Show** near **App secret**, then copy it into `DROPBOX_CLIENT_SECRET`.

### 5. Enable permissions

1. Open the **Permissions** tab.
2. Enable these scopes:

   ```text
   account_info.read
   files.metadata.read
   files.content.read
   files.content.write
   ```

3. Click **Submit** if Dropbox asks you to submit permission changes.

### 6. Copy values into `.env`

```env
DROPBOX_CLIENT_ID=your_dropbox_app_key
DROPBOX_CLIENT_SECRET=your_dropbox_app_secret
DROPBOX_REDIRECT_URI=http://localhost:8787/api/accounts/dropbox/callback
```

### Notes

- Dropbox calls the OAuth client ID an **App key**.
- The redirect URI must match exactly.
- OmniCloud requests offline access so it can keep using a refresh token.

## MEGA

MEGA does not require creating a developer OAuth application for OmniCloud.

### How MEGA connection works

1. Start OmniCloud.
2. Open the **Storage** page.
3. Click **Connect** → **MEGA**.
4. Enter:
   - MEGA email
   - MEGA password
   - 2FA code if your account uses two-factor authentication
5. Submit the form.

OmniCloud stores the MEGA session and credentials encrypted in the local SQLite database so it can sync and perform file operations later.

### Notes

- There is no `MEGA_CLIENT_ID` or `MEGA_CLIENT_SECRET` for this implementation.
- Keep your local `.env` and SQLite database private.
- If MEGA returns `EAGAIN`, it means MEGA is temporarily busy or unavailable. Try connecting again later.

## What needs OAuth, and what does not

OmniCloud supports two connection styles:

| Provider | OAuth app required? | What you prepare | Where you connect |
| --- | --- | --- | --- |
| Google Drive | Yes (OAuth client in Google Cloud) | Client ID + secret in `.env` | Connect → Google Drive (redirect login) |
| OneDrive | Yes (Entra app registration) | Client ID + secret in `.env` | Connect → OneDrive (redirect login) |
| Dropbox | Yes (Dropbox app) | App key + secret in `.env` | Connect → Dropbox (redirect login) |
| **Yandex Disk** | **Yes (Yandex OAuth app)** | Client ID + secret in `.env` | Connect → Yandex Disk (redirect login) |
| MEGA | No | Email + password (+ 2FA) | Connect → MEGA (in-app form) |
| **pCloud** | **No** | Email + password | Connect → pCloud (in-app form) |
| **S3 (R2, B2, Tebi, Storj, iDrive e2, MinIO, any S3 API)** | **No** | Access Key ID + Secret + bucket + endpoint (+ region) | Connect → S3 (in-app form) |

The distinction is between **developer credentials** (you, the operator, register an app once and put the keys in `.env`) and **end-user credentials** (each user logs in with their own account):

- **Developer credentials in `.env`:** Google Drive, OneDrive, Dropbox, and **Yandex Disk** use a redirect OAuth flow — register the app once, set the client id/secret in `.env`, and every user simply clicks Connect and authorizes.
- **End-user credentials only (no `.env`):** **MEGA** and **pCloud** take the user's email/password directly. **S3 services** take per-bucket access keys — these are genuinely per-user/per-bucket, so they stay in the connect form, not `.env`.

## pCloud

pCloud does not require a developer OAuth application.

### How pCloud connection works

1. Start OmniCloud.
2. Open the **Storage** page.
3. Click **Connect** → **pCloud**.
4. Enter your pCloud email and password.
5. Submit.

OmniCloud logs in using pCloud's digest auth, stores the resulting auth token (and your credentials, encrypted) so it can re-login automatically when the token expires. Both the US (`api.pcloud.com`) and EU (`eapi.pcloud.com`) regions are detected automatically.

### Notes

- No `PCLOUD_CLIENT_ID` / secret needed.
- If you have 2FA enabled on pCloud, generate an app-specific password or disable 2FA for this login.

## Yandex Disk

Yandex Disk uses a standard redirect OAuth flow, just like Google, OneDrive, and Dropbox. You register one app, put the client id/secret in `.env`, and each user simply clicks Connect and authorizes in their browser.

### 1. Create a Yandex OAuth app

1. Open the Yandex OAuth app registration page:

   `https://oauth.yandex.com/client/new`

2. Give the app a name, for example `OmniCloud Local`.
3. Under **Platforms**, choose **Web services** and set the **Redirect URI** to:

   ```text
   http://localhost:8787/api/accounts/yandex/callback
   ```

4. Under **Permissions / scopes**, add the Yandex.Disk REST API scopes:

   ```text
   cloud_api:disk.read
   cloud_api:disk.write
   cloud_api:disk.info
   ```

5. Create the app.

### 2. Copy values into `.env`

Yandex shows a **ClientID** and **Client secret**:

```env
YANDEX_CLIENT_ID=your_yandex_client_id
YANDEX_CLIENT_SECRET=your_yandex_client_secret
YANDEX_REDIRECT_URI=http://localhost:8787/api/accounts/yandex/callback
```

### 3. Connect in OmniCloud

1. Open the **Storage** page and click **Connect** → **Yandex Disk**.
2. You are redirected to Yandex to authorize.
3. After approving, you return to the **Storage** page, already connected.

### Notes

- The redirect URI must match the one registered exactly.
- OmniCloud stores the refresh token and refreshes the access token automatically.
- No user needs the client id/secret — that is the operator's app config.

## S3-compatible storage (Cloudflare R2, Backblaze B2, Tebi.io, Storj, iDrive e2, MinIO, and more)

All S3-compatible services share a single adapter. None require OAuth — you generate access keys in each provider's console.

The OmniCloud **Connect → S3** form has no provider presets: every field is entered manually, so the same form works with any S3-compatible service. Paste the access keys, bucket, endpoint, and region straight from your provider console.



### Fields in the form

- **Access Key ID** and **Secret Access Key** — generated in the provider console.
- **Bucket Name** — an existing bucket (OmniCloud verifies access with a `HeadBucket` check before saving). Use the exact bucket name from your console; a wrong name returns a clear "bucket not found" error.
- **Region** — type the region for your bucket; defaults to `auto` if left blank.
- **Endpoint** — required. Paste the S3 endpoint URL for your provider (e.g. `https://s3.tebi.io`).
- **Display Name** (optional) — a friendly label shown in the UI.
- **Quota (GB)** (optional) — object storage does not report a quota, so OmniCloud uses this value for allocation math. Defaults to 10 GB if left blank.

### Notes

- The access key needs read + write + list permissions on the bucket.
- For Cloudflare R2, the account ID in the endpoint is found on the R2 overview page.
- For Backblaze B2, the S3 endpoint region must match the region shown for your bucket.
- No `.env` changes are needed for S3 — everything is entered in the form and stored encrypted.

## After editing `.env`

Restart the API server so the new values are loaded:

```text
npm run dev
```

Then open OmniCloud and connect accounts from the **Storage** page. For the redirect-based providers (Google Drive, OneDrive, Dropbox, Yandex Disk), you are sent to the provider to authorize and then returned to the **Storage** page — you stay on that page the whole time.

## Troubleshooting

### Redirect URI mismatch

If a provider says the redirect URI is invalid, verify that the value in the provider dashboard exactly matches the value in `.env`.

### Missing client secret

For OneDrive, use the client secret **Value**, not the Secret ID.

For Dropbox, use **App secret**, not the app name.

### Google app is blocked or unavailable

Make sure the OAuth consent screen is configured and that your Google account is added as a test user while the app is in testing mode.

### OneDrive consent fails

Some Microsoft work or school accounts require admin consent. Use a personal Microsoft account or ask the tenant admin to approve the requested permissions.

### Dropbox refresh token is missing

Make sure you are using the OmniCloud connect flow. The backend requests offline access automatically.

### MEGA temporary error

`EAGAIN` means the MEGA service is temporarily busy or unavailable. Wait a few moments and try again.
