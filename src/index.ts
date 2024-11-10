// Desired to take data from a Jira Issue and its Subtasks based on a Branch name
import * as fs from "fs";
import * as dotenv from "dotenv";
dotenv.config();

const branchName = process.env.BRANCH_NAME ?? "";
const apiToken = process.env.JIRA_API_TOKEN ?? "";
const email = process.env.JIRA_EMAIL ?? "";
const domain = process.env.JIRA_DOMAIN ?? "";
const project_key = process.env.JIRA_PROJECT_KEY ?? "";

const releaseFile = "RELEASE_NOTES.md";

const match = branchName.match(new RegExp(`${project_key}-\\w+`));

let jira_ticket: string;

if (match) {
  jira_ticket = match[0];
  jiraApiResponse(jira_ticket);
} else {
  console.log(`Error. Match is ${match}`);
}

function jiraApiResponse(jira_ticket: string) {
  const url = `https://${domain}.atlassian.net/rest/api/2/issue/${jira_ticket}/`;

  fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Basic ${Buffer.from(`${email}:${apiToken}`).toString(
        "base64",
      )}`,
      Accept: "application/json",
    },
  })
    .then((response) => {
      console.log(`Response: ${response.status} ${response.statusText}`);
      if (response.ok) {
        return response.json(); // Parse JSON if the response is valid
      } else if (response.status === 404) {
        console.log(`Issue ${jira_ticket} not found. Exiting`);
        return;
      } else {
        throw new Error(`Request failed with status ${response.status}`);
      }
    })
    .then((data) => {
      // Extract the 'subtasks' field from the response data
      const subtasksData = data.fields.subtasks;

      // Optionally, filter the subtasks data (for example, to include only 'summary' and 'status')
      const filteredSubtasks = subtasksData.map(
        (subtask: {
          key: any;
          fields: {
            summary: any;
            status: { name: any };
            assignee: { displayName: any };
          };
        }) => ({
          key: subtask.key,
          summary: subtask.fields.summary,
          status: subtask.fields.status.name,
          assignee: subtask.fields.assignee
            ? subtask.fields.assignee.displayName
            : "Unassigned",
        }),
      );

      // Write the filtered subtasks data to a file
      let file = "subtasks.json";
      fs.writeFile(file, JSON.stringify(filteredSubtasks, null, 4), (err) => {
        if (err) {
          console.error("Error writing file:", err);
        } else {
          console.log(`Filtered subtasks written to ${file}`);
          parseJsonFileContent(file, jira_ticket);
        }
      });
    })
    .catch((err) => {
      console.error("Error:", err);
    });
}

function parseJsonFileContent(file: string, mainIssue: string) {
  try {
    const data = fs.readFileSync(file, "utf-8");

    const jsonData = JSON.parse(data);

    console.log("Parent Issue: ", mainIssue);

    writeRelease();

    try {
      jsonData.forEach(
        (issue: { key: string; summary: string; status: string }) => {
          const issueKey = issue.key;
          const issueSummary = issue.summary;
          const status = issue.status;

          if (status != "Done") {
            console.log(`Subtasks ${issueKey} not done`);
            return;
          } else {
            console.log("Issue Key: ", issueKey);
            console.log("Issue Summary: ", issueSummary);
            try {
              addIssuesToRelease(issueKey, issueSummary);
            } catch (error) {
              console.log("Error writing release: ", error);
              return;
            }
          }
        },
      );
    } catch (error) {
      console.log("Error writing release ", error);
      return;
    }
  } catch (err) {
    console.log("Error reading file: ", err);
    return;
  }
}

function writeRelease() {
  const issueURL = `https://${domain}.atlassian.net/jira/software/projects/${project_key}/boards/1?selectedIssue=${jira_ticket}`;
  const readmeContent = `
  ## Parent Issue 
  [${jira_ticket}](${issueURL})

  ## Main Updates
  `;

  // Write the content to README.md
  fs.writeFile(releaseFile, readmeContent, (err) => {
    if (err) {
      console.error("Error writing to file", err);
      return;
    } else {
      console.log(`${releaseFile} has been created!`);
    }
  });
}

function addIssuesToRelease(issueKey: string, issueSummary: string) {
  const issueURL = `https://${domain}.atlassian.net/jira/software/projects/${project_key}/boards/1?selectedIssue=${issueKey}`;
  const readmeContent = `
  - [${issueKey}](${issueURL}): ${issueSummary}
  `;

  // Write the content to README.md
  fs.appendFile(releaseFile, readmeContent, (err) => {
    if (err) {
      console.error("Error updating file", err);
      return;
    } else {
      console.log(`${releaseFile} has been updated!`);
    }
  });
}
