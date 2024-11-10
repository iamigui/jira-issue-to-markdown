# Jira Issue to Markdown Action

This action allows you to retrieve Jira `DONE` subtasks from an issue and generate a markdown file with release notes, including detailed issue and subtask information.

> [!WARNING]
>
> The branch name must match the pattern used in Jira. Refer to [Inputs](#inputs) for more information.

## Features

- Retrieve Jira issues and `DONE` subtasks.
- Format Jira issue details into markdown.
- Output a formatted release description suitable for GitHub releases.
- Integrate directly with GitHub pull requests and push events.

## Usage

To use this action, you need to pass the `branch_name` (matching your Jira issue pattern) and `jira_data` (which contains your Jira authentication and project information).

Here’s how you can use this action in your GitHub workflow:

```yaml
jobs:
  jira-issue-to-markdown:
    name: Run Jira Tasks
    runs-on: ubuntu-latest
    steps:
      - name: Jira Tasks
        id: jira_tasks
        uses: iamigui/jira-issue-to-markdown@v1
        with:
          branch_name: "branchname"
          jira_data: ${{ secrets.JIRA_DATA }}
```

## Inputs

The inputs are passed as Environment Variables.

- **branch_name** (required): The branch name that corresponds to the Jira issue key (e.g., PROJECTKEY-10). This is used to fetch the corresponding Jira issue and its subtasks.

> [!WARNING]
>
> Ensure your branch_name matches the pattern used for Jira issues (e.g., PROJECTKEY-123).

- **jira_data** (required): A JSON object from a `secret` containing the following keys for authentication and project information:

```JSON
{
  "api_token": "your-api-token",
  "email": "email@example.com",
  "domain": "youratlassiandomain",
  "project_key": "PROJECTKEY"
}
```

These values will be passed to the action securely as GitHub secrets. See [Secret Inputs](#secret-inputs) for more details.

## Outputs

- **release_content**: The formatted release notes in markdown, which includes the parent issue and its associated subtasks.

Example output:

```markdown
## Parent Issue

[SCRUM-10](https://youratlassiandomain.atlassian.net/jira/software/projects/SCRUM/boards/1?selectedIssue=PROJECTKEY-10)

## Main Updates

- [SCRUM-14](https://youratlassiandomain.atlassian.net/jira/software/projects/SCRUM/boards/1?selectedIssue=PROJECTKEY-14): Create subtasks to be passed into the release file
- [SCRUM-18](https://youratlassiandomain.atlassian.net/jira/software/projects/SCRUM/boards/1?selectedIssue=PROJECTKEY-18): Handle response data
- [SCRUM-19](https://youratlassiandomain.atlassiandomain.atlassian.net/jira/software/projects/SCRUM/boards/1?selectedIssue=PROJECTKEY-19): Only add DONE subtask
```

## Example: Integrate in Pull Request Release

This example shows how to use this action specifically in a pull request to automatically generate and attach release notes based on Jira issues and subtasks.

```YAML
name: Tag and Release in Github

on:
  push:
    branches:
      - feature/*
      - release/*
      - fix/*
      - bugfix/*
  pull_request:
    types: [closed]

permissions:
  contents: write # Grant permission to write to the repository

jobs:
  tag-release:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Set up Git
        shell: bash
        run: |
          git config user.name "gh-actions-releaser"
          git config user.email "ghactionsreleaser@gmail.com"

      - name: Get tag
        shell: bash
        id: get_tag
        run: |
          git fetch --all

          if [ -z "${{ github.event.pull_request.head.ref }}" ]; then
            echo "branch=${{ github.ref }}" >> $GITHUB_OUTPUT
          else
            git checkout ${{ github.event.pull_request.head.ref }}
            echo "branch=${{ github.event.pull_request.head.ref }}" >> $GITHUB_OUTPUT
          fi
          echo "version=v$(npm pkg get version | tr -d '\"')" >> $GITHUB_OUTPUT

      - name: Tag the commit
        if: ${{ github.event.pull_request.merged == true }}
        shell: bash
        run: |
          next_version=${{ steps.get_tag.outputs.version }}
          git tag $next_version
          git push origin $next_version
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

      - name: Mask secrets
        id: mask_secrets
        uses: actions/github-script@v7
        with:
          script: |
            const jira_data = `${{ secrets.JIRA_DATA }}` || '{}';

            const data = JSON.parse(jira_data);

            try {
              core.setSecret(data.api_token);
              core.setSecret(data.email);
              core.setSecret(data.domain);
              core.setSecret(data.project_key);
            } catch (error) {
              core.setFailed(`'jira_data' should be a valid JSON`)
            }

      - name: Launch Jira Tasks
        id: jira_tasks
        uses: iamigui/jira-issue-to-markdown@main
        env:
          BRANCH_NAME: ${{ steps.get_tag.outputs.branch }}
          JIRA_API_TOKEN: ${{ fromJSON(secrets.JIRA_DATA).api_token }}
          JIRA_EMAIL: ${{ fromJSON(secrets.JIRA_DATA).email }}
          JIRA_DOMAIN: ${{ fromJSON(secrets.JIRA_DATA).domain }}
          JIRA_PROJECT_KEY: ${{ fromJSON(secrets.JIRA_DATA).project_key }}

      - name: Set Outputs
        id: set_outputs
        uses: actions/github-script@v7
        with:
          script: |
            const fs = require('fs');
            const releaseFileContent = fs.readFileSync('RELEASE_NOTES.md', 'utf-8')

            core.setOutput('release_content', releaseFileContent)

      - name: Debug Outputs
        run: |
          echo "Release content from the previous step: ${{ steps.set_outputs.outputs.release_content }}"

      - name: Release
        id: release
        shell: bash
        if: ${{ github.event.pull_request.merged == true }}
        run: |
          TAG_NAME=${{ steps.get_tag.outputs.version }}
          PR_DESCRIPTION="${{ steps.set_outputs.outputs.release_content }}"
          echo "Creating release for tag: $TAG_NAME"
          echo "Description: $PR_DESCRIPTION"

          # Create the release with the PR description
          gh release create $TAG_NAME --title "$TAG_NAME" --notes "$PR_DESCRIPTION"
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

```

## Secret Inputs

To securely pass Jira credentials, you need to set up the following secrets in your GitHub repository:

Example of **JIRA_DATA** secret:

```JSON
{
  "api_token": "your-api-token",
  "email": "email@example.com",
  "domain": "youratlassiandomain",
  "project_key": "PROJECTKEY"
}
```

Make sure to add these secrets in your GitHub repository's Secrets section (**Settings > Secrets and variables > Actions**).

## Work Locally

To test the application locally or in a dev environment:

### Install dependencies

```shell
npm install
```

### Configure .env

```shell
touch .env
```

```.env
JIRA_API_TOKEN="yourapitoken"
JIRA_DOMAIN="yourjiradomain"
JIRA_EMAIL="yourjiraemail"
JIRA_PROJECT_KEY="yourjiraprojectkey"
BRANCH="yourbranch"
```

### Compile and run

```shell
npm run clean

npm run format

npm run lint

npm run build
```
