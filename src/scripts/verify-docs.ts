import {
  buildSyncReadinessReport,
  validateServiceDocs
} from "@/shared/docs/documentation-tooling";

const { files, issues } = await validateServiceDocs();
const syncReport = buildSyncReadinessReport(files);
const allIssues = [...issues, ...syncReport.issues];

if (allIssues.length > 0) {
  for (const issue of allIssues) {
    console.error(`${issue.filePath}: ${issue.message}`);
  }

  process.exit(1);
}

console.log(`Documentation checks passed for ${String(files.length)} files.`);
