# Data deletion

This page explains how to delete your Ozer account and any Instagram, TikTok, or Google connections we store. It is also the public instructions page for Meta app review (Feedflow Instagram and Auto-Reply).

Ozer is operated by Oodle Designs Ltd. Questions: [privacy@ozer.so](mailto:privacy@ozer.so).

## Delete your Ozer account

You can delete your personal Ozer account yourself. We do not use an “email us and wait” path for this.

1. Sign in to Ozer.
2. Open **Personal settings** at [/app/settings](/app/settings).
3. Scroll to **Danger zone**.
4. Choose **Delete account**, confirm with the email code we send, and confirm again.

That permanently deletes your personal account and the customer data tied to it. Workspace files in storage are removed within 30 days. Records we must keep by law (for example billing records for tax) are retained as described in our [Privacy Policy](/privacy-policy).

Team workspaces are separate. An owner can remove members or close a workspace from that workspace’s **Settings**. Closing a team workspace is not the same as deleting your personal login.

## Remove Instagram, TikTok, or Google connections

If you only want to disconnect a social account and keep using Ozer, do that in the product. Tokens are deleted immediately on disconnect.

### Feedflow social accounts

1. Sign in and open the workspace that connected the account.
2. Go to **Feedflow → Social accounts** (`/app/{workspace}/social/accounts`).
3. Choose **Remove** on the Instagram, TikTok, or Google connection.

This deletes the stored access tokens and cached feed data for that connection. Widgets that used it will stop working until you connect another account.

### Auto-Reply (Instagram comments)

1. Sign in and open the workspace that connected Instagram.
2. Go to **Instagram** (`/app/{workspace}/instagram`).
3. Disconnect the Instagram Business account.

This deletes the connection, its access token, keyword triggers, and related comment-event logs for that workspace.

## Request deletion from Instagram (Meta)

If you connected Instagram to Ozer through Meta, you can also ask Meta to tell us to delete that Instagram data:

1. Open the Instagram app or [instagram.com](https://www.instagram.com).
2. Go to **Settings → Apps and websites** (or **Accounts Centre → Your activity → Apps and websites**, depending on the app version).
3. Find the Ozer / Feedflow Instagram app and remove it, or use Instagram’s data-deletion option for that app.

Meta then sends a signed request to our callback. We verify it, delete or anonymise the Instagram data we store for that Meta user id, and return a confirmation code.

Check the result at [/data-deletion/status](/data-deletion/status) using the confirmation code Meta shows you.

What we delete from a Meta callback:

- Feedflow `social_accounts` rows for Instagram (tokens and cache) when they match the Meta user id.
- Auto-Reply connected Instagram accounts, plus related triggers and comment events for that connection.
- Commenter identifiers on Auto-Reply events when they match the same Meta user id.

TikTok and Google Feedflow rows are only removed when they can be matched to that Meta user id. They usually cannot, so disconnect those in **Feedflow → Social accounts** or delete your Ozer account.

A Meta deletion request does **not** delete your whole Ozer account. Use **Personal settings → Delete account** for that.

## Status of a Meta request

After Meta calls us, you can open:

`/data-deletion/status?code={confirmation_code}`

The page shows whether we received the request and whether Instagram data was processed. It does not show Instagram user ids or tokens.

## Contact

If something is stuck, email [privacy@ozer.so](mailto:privacy@ozer.so) with the confirmation code (if you have one) and the email on your Ozer account. See also our [Privacy Policy](/privacy-policy) and [Terms of Service](/terms-of-service).
