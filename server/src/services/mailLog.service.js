const MailLog = require("../models/MailLog");

const MAIL_LOG_RETENTION_DAYS = 15;
const DAY_MS = 24 * 60 * 60 * 1000;

function getMailLogCutoffDate() {
  return new Date(Date.now() - MAIL_LOG_RETENTION_DAYS * DAY_MS);
}

async function cleanupExpiredMailLogs() {
  await MailLog.deleteMany({ createdAt: { $lt: getMailLogCutoffDate() } });
}

async function recordMailLog(payload) {
  await cleanupExpiredMailLogs();
  return MailLog.create({
    ...payload,
    sentAt: payload?.sentAt || new Date(),
  });
}

module.exports = {
  MAIL_LOG_RETENTION_DAYS,
  cleanupExpiredMailLogs,
  recordMailLog,
};
