const { verifyAccessToken } = require('../utils/jwt.util');

/**
 * Verifies the Bearer access token and attaches the decoded payload
 * (id, username, roles[], permissions[]) to req.user.
 */
function authenticate(req, res, next) {
  const header = req.headers.authorization;

  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or malformed Authorization header.' });
  }

  const token = header.split(' ')[1];

  try {
    const decoded = verifyAccessToken(token);
    req.user = decoded;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Access token expired.' });
    }
    return res.status(401).json({ error: 'Invalid access token.' });
  }
}

module.exports = { authenticate };
