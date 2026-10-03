# Power Apps Workflow Applications

Four React and TypeScript applications for operational workflows, built as Microsoft Power Apps code apps with SharePoint connectors and Power Automate flows.

| Application | Workflow | Source |
| --- | --- | --- |
| 5R Audit | Workplace audit scoring, photographic evidence and corrective action follow-up | [5RAUDIT](5RAUDIT/) |
| TCCD | Training and certification requests, participants, approval routing and administration | [TCCD](TCCD/) |
| Vehicle Mileage | Vehicle and driver selection, mileage entry and reporting | [Vehicle-km](Kilometer%20Kendaraan/Vehicle-km/) |
| Unblock Material | Material release ticket browsing, status filters and linked material details | [UNBLOCK MATERIAL](UNBLOCK%20MATERIAL/) |

Each application has its own package manifest, lockfile and build. There is no shared server in this repository: data access uses the Power Apps SDK, generated connector services and, where needed, connector-backed SharePoint HTTP operations.

## Local development

Use Node.js 24 and npm. From the application directory:

```powershell
npm ci
npm run setup
npm run dev
```

For example, start TCCD from the repository root:

```powershell
cd TCCD
npm ci
npm run dev
```

`dev` and `build` run setup automatically. Setup copies example files only when the local files are missing. It does not overwrite an existing configuration.

```powershell
npm run build
npm run lint
```

The examples support compilation and inspection of the source. They do not supply a working SharePoint tenant, a local mock backend or deployed Power Automate flows. Live data operations require a configured Power Apps environment and authenticated runtime.

## Integration setup

See [Power Apps integration](docs/integration.md) for configuration files, connector generation and application-specific requirements.

- `power.config.example.json` contains example environment, connection, list and flow identifiers.
- `config/dataSourcesInfo.example.ts` supplies an example descriptor for compilation. Setup copies it to the ignored `.power` directory.
- `src/generated` contains the typed connector models and services, including the Microsoft copyright notices. Regenerate these files when the target schema changes.
- TCCD uses synthetic employee records by default. Real employee workbooks and converted data stay outside version control.

Tenant-specific configuration, internal reference notes, agent prompts, logs, preview exports and operational datasets are excluded from this repository. SharePoint list permissions and flow permissions must enforce access; client-side role checks alone are insufficient.

## Scope and validation

The source includes forms, connector calls and workflow UI. A successful build establishes that the TypeScript and frontend assets compile; it does not verify tenant permissions, approval delivery, file uploads or production deployment. Flow implementations and SharePoint provisioning are not included.

The Unblock Material example descriptor intentionally has no connector operations. Generate a real descriptor before using its data screens. TCCD employee lookup is bundled into the frontend; use only data that is appropriate to distribute to every user of the app.

Local verification on 2026-10-03 used Node.js 24 and the committed lockfiles:

| Application | Build | ESLint |
| --- | --- | --- |
| 5R Audit | Passed | 6 errors |
| TCCD | Passed | 7 errors, 3 warnings |
| Vehicle Mileage | Passed | 4 errors |
| Unblock Material | Passed | Passed |

The remaining lint findings concern state updates in effects, effect dependencies, mixed component exports, an unused parameter and irregular whitespace. The build workflow checks all four applications; lint is not yet a passing gate. 5R Audit and Vehicle Mileage also emit bundle-size warnings. Live connector behavior and deployment were not verified in this check.
