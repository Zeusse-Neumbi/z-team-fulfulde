import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const plan = JSON.parse(readFileSync(path.join(root, "scripts/project-plan.json"), "utf8"));

const owner = plan.owner;
const repo = plan.repo;
const projectNumber = process.env.PROJECT_NUMBER ? Number(process.env.PROJECT_NUMBER) : null;

function gh(args) {
  return execFileSync("gh", args, {
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
    timeout: 120_000,
  }).trim();
}

function ghJson(args) {
  const output = gh(args);
  return output ? JSON.parse(output) : null;
}

function graphql(query) {
  return ghJson(["api", "graphql", "-f", `query=${query}`]);
}

function findProject() {
  if (projectNumber) {
    const view = ghJson(["project", "view", String(projectNumber), "--owner", owner, "--format", "json"]);
    return view;
  }

  const listing = ghJson(["project", "list", "--owner", owner, "--limit", "100", "--format", "json"]);
  return listing.projects.find((project) => project.title === plan.project.title) ?? null;
}

function createOrReuseProject() {
  let project = findProject();

  if (!project) {
    project = ghJson([
      "project",
      "create",
      "--owner",
      owner,
      "--title",
      plan.project.title,
      "--format",
      "json",
    ]);
    console.log(`Created project #${project.number} (${project.id})`);
  } else {
    console.log(`Reusing project #${project.number} (${project.id})`);
  }

  gh([
    "project",
    "edit",
    String(project.number),
    "--owner",
    owner,
    "--visibility",
    plan.project.visibility,
    "--description",
    plan.project.description,
    "--readme",
    plan.project.readme,
  ]);

  try {
    gh(["project", "link", String(project.number), "--owner", owner, "--repo", repo]);
    console.log(`Linked project #${project.number} to ${repo}`);
  } catch (error) {
    const message = String(error.stderr ?? error.message);
    if (!message.includes("already linked")) {
      console.warn(`Could not link project: ${message.trim()}`);
    }
  }

  return project;
}

function readFields(number) {
  const listing = ghJson(["project", "field-list", String(number), "--owner", owner, "--format", "json"]);
  return listing.fields;
}

function ensureStatusOptions(project, fields) {
  const status = fields.find((field) => field.name === "Status");
  if (!status) throw new Error("The project has no Status field.");

  const existingNames = new Set((status.options ?? []).map((option) => option.name));
  const missing = plan.statusOptions.some((option) => !existingNames.has(option.name));
  if (!missing) return status;

  const options = plan.statusOptions
    .map((option) => {
      const existing = (status.options ?? []).find((candidate) => candidate.name === option.name);
      const id = existing ? `id: ${JSON.stringify(existing.id)}, ` : "";
      return `{${id}name: ${JSON.stringify(option.name)}, color: ${option.color}, description: ${JSON.stringify(option.description)}}`;
    })
    .join(", ");

  const result = graphql(`
    mutation {
      updateProjectV2Field(input: {
        fieldId: ${JSON.stringify(status.id)},
        singleSelectOptions: [${options}]
      }) {
        projectV2Field {
          ... on ProjectV2SingleSelectField { id name options { id name } }
        }
      }
    }
  `);

  if (result.errors) throw new Error(JSON.stringify(result.errors));
  console.log("Updated Status options");
  return readFields(project.number).find((field) => field.name === "Status");
}

function ensureFields(project) {
  let fields = readFields(project.number);
  const byName = new Map(fields.map((field) => [field.name, field]));

  for (const definition of plan.fields) {
    if (byName.has(definition.name)) continue;

    const args = [
      "project",
      "field-create",
      String(project.number),
      "--owner",
      owner,
      "--name",
      definition.name,
      "--data-type",
      definition.type,
      "--format",
      "json",
    ];
    if (definition.type === "SINGLE_SELECT") {
      args.push("--single-select-options", definition.options.join(","));
    }

    const field = ghJson(args);
    console.log(`Created field ${definition.name}`);
    byName.set(field.name, field);
  }

  fields = readFields(project.number);
  ensureStatusOptions(project, fields);
  return readFields(project.number);
}

function projectViews(project) {
  const result = graphql(`
    query {
      user(login: ${JSON.stringify(owner)}) {
        projectV2(number: ${project.number}) {
          views(first: 50) { nodes { id name number layout filter } }
        }
      }
    }
  `);
  if (result.errors) throw new Error(JSON.stringify(result.errors));
  return result.data.user.projectV2.views.nodes;
}

function ensureViews(project, fields) {
  const fieldIds = new Map(fields.map((field) => [field.name, field.id]));
  const existing = new Map(projectViews(project).map((view) => [view.name, view]));

  for (const definition of plan.views) {
    const visibleFieldIds = (definition.visibleFields ?? [])
      .map((name) => fieldIds.get(name))
      .filter(Boolean);

    const current = existing.get(definition.name);
    if (!current) {
      const configuration = visibleFieldIds.length
        ? `, configuration: {visibleFieldIds: ${JSON.stringify(visibleFieldIds)}}`
        : "";
      const result = graphql(`
        mutation {
          createProjectV2View(input: {
            projectId: ${JSON.stringify(project.id)},
            name: ${JSON.stringify(definition.name)},
            layout: ${definition.layout}${configuration}
          }) {
            projectV2View { id name number layout filter }
          }
        }
      `);
      if (result.errors) {
        if (String(JSON.stringify(result.errors)).includes("Roadmap views do not support visible fields")) {
          const retry = graphql(`
            mutation {
              createProjectV2View(input: {
                projectId: ${JSON.stringify(project.id)},
                name: ${JSON.stringify(definition.name)},
                layout: ${definition.layout}
              }) {
                projectV2View { id name number layout filter }
              }
            }
          `);
          if (retry.errors) throw new Error(JSON.stringify(retry.errors));
          console.log(`Created view ${definition.name}`);
        } else {
          throw new Error(JSON.stringify(result.errors));
        }
      } else {
        console.log(`Created view ${definition.name}`);
      }
    }

    if (definition.filter) {
      const view = projectViews(project).find((candidate) => candidate.name === definition.name);
      if (view && view.filter !== definition.filter) {
        const result = graphql(`
          mutation {
            updateProjectV2View(input: {
              viewId: ${JSON.stringify(view.id)},
              filter: ${JSON.stringify(definition.filter)}
            }) {
              projectV2View { id name filter }
            }
          }
        `);
        if (result.errors) throw new Error(JSON.stringify(result.errors));
        console.log(`Set filter on view ${definition.name}`);
      }
    }
  }
}

function ensureMilestones() {
  const existing = new Set(ghJson(["api", `repos/${repo}/milestones?state=all&per_page=100`]).map((milestone) => milestone.title));

  for (const milestone of plan.milestones) {
    if (existing.has(milestone.title)) continue;

    const args = [
      "api",
      "-X",
      "POST",
      `repos/${repo}/milestones`,
      "-f",
      `title=${milestone.title}`,
      "-f",
      `description=${milestone.description}`,
    ];
    if (milestone.due_on) args.push("-f", `due_on=${milestone.due_on}`);

    gh(args);
    console.log(`Created milestone ${milestone.title}`);
  }
}

function ensureLabels() {
  const existing = new Set(ghJson(["label", "list", "--repo", repo, "--limit", "200", "--json", "name"]).map((label) => label.name));

  for (const label of plan.labels) {
    if (existing.has(label.name)) continue;
    gh([
      "label",
      "create",
      label.name,
      "--repo",
      repo,
      "--color",
      label.color,
      "--description",
      label.description,
    ]);
    console.log(`Created label ${label.name}`);
  }
}

function issueList() {
  return ghJson([
    "issue",
    "list",
    "--repo",
    repo,
    "--state",
    "all",
    "--limit",
    "200",
    "--json",
    "number,title,url,state",
  ]);
}

function projectItems(project) {
  const listing = ghJson([
    "project",
    "item-list",
    String(project.number),
    "--owner",
    owner,
    "--limit",
    "500",
    "--format",
    "json",
  ]);
  return new Map(
    (listing.items ?? []).map((item) => [item.content?.url ?? item.title, item]),
  );
}

function ensureIssue(issue, existingIssues) {
  let current = existingIssues.find((candidate) => candidate.title === issue.title);

  if (!current) {
    const args = [
      "issue",
      "create",
      "--repo",
      repo,
      "--title",
      issue.title,
      "--body",
      issue.body,
    ];
    for (const label of issue.labels ?? []) args.push("--label", label);
    if (issue.milestone) args.push("--milestone", issue.milestone);

    const issueUrl = gh(args);
    current = ghJson(["issue", "view", issueUrl, "--repo", repo, "--json", "number,title,url,state"]);
    existingIssues.push(current);
    console.log(`Created issue #${current.number} ${issue.title}`);
  } else {
    console.log(`Reusing issue #${current.number} ${issue.title}`);
  }

  if (issue.state === "closed" && current.state !== "CLOSED") {
    gh(["issue", "close", String(current.number), "--repo", repo, "--reason", "completed"]);
    current.state = "CLOSED";
    console.log(`Closed issue #${current.number}`);
  }

  return current;
}

function setFields(project, fields, itemId, values) {
  const byName = new Map(fields.map((field) => [field.name, field]));

  for (const [name, value] of Object.entries(values ?? {})) {
    if (value === null || value === undefined) continue;
    const field = byName.get(name);
    if (!field) {
      console.warn(`No field named ${name}`);
      continue;
    }

    const args = [
      "project",
      "item-edit",
      "--id",
      itemId,
      "--project-id",
      project.id,
      "--field-id",
      field.id,
    ];

    if (field.type === "ProjectV2SingleSelectField") {
      const option = (field.options ?? []).find((candidate) => candidate.name === value);
      if (!option) {
        console.warn(`No option ${value} for field ${name}`);
        continue;
      }
      args.push("--single-select-option-id", option.id);
    } else if (field.name === "Target") {
      args.push("--date", value);
    } else {
      args.push("--text", value);
    }

    gh(args);
  }
}

function ensureItems(project, fields) {
  const existingIssues = issueList();
  const items = projectItems(project);

  for (const [index, issue] of plan.issues.entries()) {
    console.log(`[${index + 1}/${plan.issues.length}] ${issue.title}`);
    const current = ensureIssue(issue, existingIssues);
    let item = items.get(current.url);

    if (!item) {
      item = ghJson([
        "project",
        "item-add",
        String(project.number),
        "--owner",
        owner,
        "--url",
        current.url,
        "--format",
        "json",
      ]);
      items.set(current.url, item);
      console.log(`Added #${current.number} to the project`);
    }

    const pending = {};
    for (const [name, value] of Object.entries(issue.fields ?? {})) {
      if (value === null || value === undefined) continue;
      if (item[name.toLowerCase()] === value) continue;
      pending[name] = value;
    }

    if (Object.keys(pending).length > 0) {
      setFields(project, fields, item.id, pending);
    }
  }
}

function ensureStatusUpdate(project) {
  const result = graphql(`
    query {
      user(login: ${JSON.stringify(owner)}) {
        projectV2(number: ${project.number}) {
          statusUpdates(first: 10) { nodes { id } }
        }
      }
    }
  `);
  if (result.errors) throw new Error(JSON.stringify(result.errors));
  if (result.data.user.projectV2.statusUpdates.nodes.length > 0) return;

  const created = graphql(`
    mutation {
      createProjectV2StatusUpdate(input: {
        projectId: ${JSON.stringify(project.id)},
        status: ON_TRACK,
        startDate: "2026-11-08",
        targetDate: "2026-11-14",
        body: "D1–D7 execution board opened. The critical path is the protected-node invariance suite, the five-page translation memory and the speaker validation. Freeze is 12 November 18:00; the form is due 13 November 18:00; the hard deadline is 14 November 23:59 Africa/Douala."
      }) {
        statusUpdate { id }
      }
    }
  `);
  if (created.errors) throw new Error(JSON.stringify(created.errors));
  console.log("Created project status update");
}

const project = createOrReuseProject();
const fields = ensureFields(project);
ensureViews(project, fields);
ensureMilestones();
ensureLabels();
ensureItems(project, fields);
ensureStatusUpdate(project);

console.log(`Project ready: https://github.com/users/${owner}/projects/${project.number}`);
