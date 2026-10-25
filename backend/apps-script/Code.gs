const SECRET_PROPERTY = 'BATTLECODE_MAIL_SECRET';
const MAX_HTML_LENGTH = 12000;
const MAX_TEXT_LENGTH = 4000;

function doPost(e) {
  try {
    const body = JSON.parse(e && e.postData && e.postData.contents || '{}');
    const expected = PropertiesService.getScriptProperties().getProperty(SECRET_PROPERTY) || '';
    if (!expected || !sameSecret(String(body.secret || ''), expected)) {
      return jsonResponse({ ok: false, error: 'unauthorized' });
    }

    const to = String(body.to || '').trim();
    const subject = String(body.subject || '');
    const text = String(body.text || '');
    const html = String(body.html || '');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to) || to.length > 254 ||
        subject !== 'Khôi phục mật khẩu BattleCode' ||
        !text || text.length > MAX_TEXT_LENGTH || !html || html.length > MAX_HTML_LENGTH) {
      return jsonResponse({ ok: false, error: 'invalid_request' });
    }

    MailApp.sendEmail({
      to: to,
      subject: subject,
      body: text,
      htmlBody: html,
      name: 'BattleCode'
    });
    return jsonResponse({ ok: true });
  } catch (error) {
    return jsonResponse({ ok: false, error: 'send_failed' });
  }
}

function sameSecret(actual, expected) {
  if (!actual || !expected) return false;
  const length = Math.max(actual.length, expected.length);
  let difference = actual.length ^ expected.length;
  for (let i = 0; i < length; i++) {
    difference |= (actual.charCodeAt(i) || 0) ^ (expected.charCodeAt(i) || 0);
  }
  return difference === 0;
}

function jsonResponse(value) {
  return ContentService.createTextOutput(JSON.stringify(value))
    .setMimeType(ContentService.MimeType.JSON);
}
