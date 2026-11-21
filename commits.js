const username = "njbusaan";
const apiBase = "https://api.github.com";
const timelineLimit = 6;
const commitsPerRepository = timelineLimit;
const requestHeaders = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
};
const timeline = document.querySelector("#commit-timeline");
const statusMessage = document.querySelector("#timeline-status");

async function fetchJson(url) {
    const response = await fetch(url, { headers: requestHeaders });
    if (!response.ok) {
        throw new Error(`GitHub API request failed (${response.status} ${response.statusText}).`);
    }

    return response.json();
}

async function fetchPublicRepositories() {
    const repositories = [];
    let page = 1;

    while (true) {
        const pageRepositories = await fetchJson(
            `${apiBase}/users/${username}/repos?type=public&sort=updated&per_page=100&page=${page}`,
        );
        repositories.push(...pageRepositories.filter((repository) => repository.private === false));

        if (pageRepositories.length < 100) {
            return repositories;
        }

        page += 1;
    }
}

async function fetchRepositoryCommits(repository) {
    if (repository.size === 0 || !repository.default_branch) {
        return [];
    }

    const url = `${apiBase}/repos/${repository.full_name}/commits?author=${username}&per_page=${commitsPerRepository}`;
    const response = await fetch(url, { headers: requestHeaders });

    if (response.status === 409) {
        return [];
    }
    if (!response.ok) {
        throw new Error(`Could not load commits for ${repository.full_name} (${response.status} ${response.statusText}).`);
    }

    const commits = await response.json();
    return commits.map((commit) => {
        const date = commit.commit.author?.date ?? commit.commit.committer?.date;
        if (!date) {
            throw new Error(`Commit ${commit.sha.slice(0, 7)} in ${repository.full_name} has no date.`);
        }

        return { ...commit, date, repository };
    });
}

async function mapConcurrent(items, limit, callback) {
    const results = new Array(items.length);
    let nextIndex = 0;
    const workerCount = Math.min(limit, items.length);

    await Promise.all(
        Array.from({ length: workerCount }, async () => {
            while (nextIndex < items.length) {
                const index = nextIndex;
                nextIndex += 1;
                results[index] = await callback(items[index]);
            }
        }),
    );

    return results;
}

function appendStat(stats, label, value) {
    const item = document.createElement("div");
    const term = document.createElement("dt");
    term.textContent = label;
    const description = document.createElement("dd");
    description.textContent = value;
    item.append(term, description);
    stats.append(item);
}

function renderCommitFiles(details, callout) {
    if (!Array.isArray(details.files) || details.files.length === 0) {
        return;
    }

    const fileDetails = document.createElement("details");
    fileDetails.className = "changed-files";
    const summary = document.createElement("summary");
    summary.textContent = `Changed files (${details.files.length})`;
    const fileList = document.createElement("ul");

    for (const file of details.files.slice(0, 10)) {
        const item = document.createElement("li");
        const filename = document.createElement("code");
        filename.textContent = file.filename;
        item.append(filename);

        if (file.status && file.status !== "modified") {
            const state = document.createElement("span");
            state.className = "file-status";
            state.textContent = file.status;
            item.append(state);
        }
        fileList.append(item);
    }

    if (details.files.length > 10) {
        const moreFiles = document.createElement("li");
        moreFiles.textContent = `${details.files.length - 10} more files; see commit details.`;
        fileList.append(moreFiles);
    }

    fileDetails.append(summary, fileList);
    callout.append(fileDetails);
}

function renderCommit(entry, index) {
    const item = document.createElement("li");
    item.className = "commit-event";

    const date = document.createElement("time");
    date.className = "commit-date";
    date.dateTime = entry.date;
    date.textContent = new Intl.DateTimeFormat(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
    }).format(new Date(entry.date));

    const callout = document.createElement("article");
    callout.className = "commit-callout";
    const metadata = document.createElement("div");
    metadata.className = "commit-meta";

    const repositoryLink = document.createElement("a");
    repositoryLink.className = "repo-name";
    repositoryLink.href = entry.repository.html_url;
    repositoryLink.target = "_blank";
    repositoryLink.rel = "noopener noreferrer";
    repositoryLink.textContent = entry.repository.name;
    metadata.append(repositoryLink);

    if (index === 0) {
        const latest = document.createElement("span");
        latest.className = "latest-commit";
        latest.textContent = "Most recent";
        metadata.append(latest);
    }

    const commitLink = document.createElement("a");
    commitLink.href = entry.html_url;
    commitLink.target = "_blank";
    commitLink.rel = "noopener noreferrer";
    commitLink.textContent = `${entry.sha.slice(0, 7)} ↗`;
    metadata.append(commitLink);

    const [title, ...bodyLines] = entry.commit.message.trim().split("\n");
    const heading = document.createElement("h3");
    heading.textContent = title || "Commit without a message";
    callout.append(metadata, heading);

    const messageBody = bodyLines.join("\n").trim();
    if (messageBody) {
        const description = document.createElement("p");
        description.textContent = messageBody;
        callout.append(description);
    }

    const details = entry.details;
    if (details.stats) {
        const stats = document.createElement("dl");
        stats.className = "commit-stats";
        appendStat(stats, "Files changed", String(details.files?.length ?? 0));
        appendStat(stats, "Added", `${details.stats.additions} lines`);
        appendStat(stats, "Removed", `${details.stats.deletions} lines`);
        callout.append(stats);
    }

    renderCommitFiles(details, callout);
    item.append(date, callout);
    return item;
}

async function loadTimeline() {
    const repositories = await fetchPublicRepositories();
    if (repositories.length === 0) {
        statusMessage.textContent = "No public repositories were found.";
        return;
    }

    const repositoryCommits = await mapConcurrent(repositories, 4, fetchRepositoryCommits);
    const seenCommits = new Set();
    const recentCommits = repositoryCommits
        .flat()
        .filter((commit) => {
            if (seenCommits.has(commit.sha)) {
                return false;
            }
            seenCommits.add(commit.sha);
            return true;
        })
        .sort((left, right) => new Date(right.date) - new Date(left.date))
        .slice(0, timelineLimit);

    if (recentCommits.length === 0) {
        statusMessage.textContent = `No authored public commits found across ${repositories.length} public repositories.`;
        return;
    }

    const detailedCommits = await mapConcurrent(recentCommits, 4, async (commit) => ({
        ...commit,
        details: await fetchJson(`${apiBase}/repos/${commit.repository.full_name}/commits/${commit.sha}`),
    }));

    for (const [index, commit] of detailedCommits.entries()) {
        timeline.append(renderCommit(commit, index));
    }
    const repositoryCount = new Set(detailedCommits.map((commit) => commit.repository.full_name)).size;
    const commitLabel = detailedCommits.length === 1 ? "commit" : "commits";
    const repositoryLabel = repositories.length === 1 ? "repository" : "repositories";
    statusMessage.textContent = `Showing ${detailedCommits.length} recent ${commitLabel} from ${repositoryCount} of ${repositories.length} public ${repositoryLabel}.`;
}

loadTimeline().catch((error) => {
    console.error("Unable to load the public GitHub commit timeline.", error);
    statusMessage.classList.add("timeline-error");
    statusMessage.textContent = `Unable to load public commits: ${error.message}`;
});
