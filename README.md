# Jira Tasks Action

This action is used to obtain Jira subtasks from a Task and output it to the release description as notes. To use this the `branch` must match the pattern used in Jira. Refer to [Inputs](#inputs) for more information

## Usage

Usage for the action. Check first [secrets](#secret-inputs) to handle properly the task:

```YAML
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

## Examples

Example on [push and pull_request](#push-and-pr) to test it.

> Recommended to be used in [Pull Request](#integrate-in-pr-release)

### Push and PR

```YAML
name: Tag and Release in Github

on:
  push:
  pull_request:
    types: [closed]

permissions:
  contents: write # Grant permission to write to the repository

jobs:
  jira-issue-to-markdown:
    name: Run Jira Tasks
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup node
        uses: actions/setup-node@v4
        with:
          node-version: "20"

      - name: Get tag
        shell: bash
        id: get_tag
        run: |
          if [ "${{ github.event_name }}" == "pull_request" ]; then
            git fetch --all
            git checkout ${{ github.event.pull_request.head.ref }}
            echo "branch=${{ github.event.pull_request.head.ref }}" >> $GITHUB_OUTPUT
          else
            echo "branch=${{ github.ref }}" >> $GITHUB_OUTPUT
          fi
          git pull
          git branch --show-current

      - name: Jira Tasks
        id: jira_tasks
        uses: iamigui/jira-issue-to-markdown@v1
        with:
          branch_name: ${{ steps.get_tag.outputs.branch }}
          jira_data: ${{ secrets.JIRA_DATA }}

      - name: Get Outputs
        shell: bash
        run: |
          echo "Release content from the previous step: ${{ steps.jira_tasks.outputs.release_content }}"
```

### Integrate in PR Release:

```YAML
name: Tag and Release in Github

on:
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
          git checkout ${{ github.event.pull_request.head.ref }}
          echo "branch=${{ github.event.pull_request.head.ref }}" >> $GITHUB_OUTPUT
          git pull
          git branch --show-current
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

      - name: Launch Jira Tasks
        id: jira_tasks
        uses: iamigui/jira-issue-to-markdown@v1
        if: ${{ github.event.pull_request.merged == true }}
        with:
          branch_name: ${{ steps.get_tag.outputs.branch }}
          jira_data: ${{ secrets.JIRA_DATA }}

      - name: Release
        id: release
        shell: bash
        if: ${{ github.event.pull_request.merged == true }}
        run: |
          TAG_NAME=${{ steps.get_tag.outputs.version }}
          PR_DESCRIPTION="${{ steps.jira_tasks.outputs.release_content }}"
          echo "Creating release for tag: $TAG_NAME"
          echo "Description: $PR_DESCRIPTION"

          # Create the release with the PR description
          gh release create $TAG_NAME --title "$TAG_NAME" --notes "$PR_DESCRIPTION"
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

## Secret Inputs

- `JIRA_DATA`: The data is passed to the action:

```JSON
{
  "api_token": "your-api-token",
  "email": "email@example.com",
  "domain": "youratlassiandomain",
  "project_key": "PROJECTKEY"
}
```

## Outputs

- `release_content`: the content of the RELEASE_NOTES.md

## Work locally

```shell
npm install

npm install -g typescript

## Add .env data that is passed in Secrets
touch .env

tsc src/index.ts

node src/index.js
```
