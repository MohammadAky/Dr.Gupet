/** Local convenience wrapper. Default dry-run; production uses the standalone compiled operator.
 * npx ts-node scripts/ensure-local-references.ts --database=<named-local-db> [--apply]
 * node dist/src/reference-data/operator.js --database=<named-prod-db> --allow-production --backup-confirmed [--apply]
 * Never invoked by startup, deployment, migrations, or broad demo seed.
 */
import '../src/reference-data/operator';
