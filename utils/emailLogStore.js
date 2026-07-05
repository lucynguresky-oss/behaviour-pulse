import EmailLog from '../models/EmailLog.js';

/**
 * Retrieves list of email logs matching the query criteria.
 * @param {Object} query - Key-value pair filters (e.g. schoolId, studentEmail)
 * @returns {Promise<Array<Object>>} Normalized email log objects
 */
export async function getEmailLogs(query = {}) {
  try {
    const docs = await EmailLog.find(query);
    return docs.map(doc => {
      const logObj = doc.toObject ? doc.toObject() : { ...doc };
      return { id: logObj._id || logObj.id, ...logObj };
    });
  } catch (err) {
    console.error("Error reading email logs:", err.message);
    return [];
  }
}

/**
 * Creates and registers a new pending email log transaction.
 * @param {Object} log - Initial properties of the log
 * @returns {Promise<Object>} Newly created normalized log record
 */
export async function addEmailLog(log) {
  try {
    const newLog = await EmailLog.create({ status: 'pending', ...log });
    const logObj = newLog.toObject ? newLog.toObject() : { ...newLog };
    return { id: logObj._id || logObj.id, ...logObj };
  } catch (err) {
    console.error("Error creating email log:", err.message);
    throw err;
  }
}

/**
 * Updates an existing email log (e.g. status changes, SMTP preview URLs).
 * @param {String} id - Unique log record identifier
 * @param {Object} update - Partial fields containing modifications
 * @returns {Promise<Object|null>} Normalized updated log record
 */
export async function updateEmailLog(id, update) {
  try {
    const updated = await EmailLog.findByIdAndUpdate(id, update);
    if (!updated) return null;
    const logObj = updated.toObject ? updated.toObject() : { ...updated };
    return { id: logObj._id || logObj.id, ...logObj };
  } catch (err) {
    console.error(`Error updating email log ${id}:`, err.message);
    return null;
  }
}
