const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function sectorFilter(req, res, next) {
  const sectorId = req.query.sector_id;
  req.sectorId = sectorId && UUID_RE.test(sectorId) ? sectorId : null;
  next();
}
