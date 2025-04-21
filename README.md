# actions-repo-spotlight

A GitHub Action and CLI tool that generates a list of your most visited repositories based on GitHub traffic data.

---

## 🚀 GitHub Action Usage

Automatically generate a spotlight list of your most viewed repositories:

```yaml
- uses: actionsforge/actions-repo-spotlight@v1
  with:
    token: ${{ secrets.GH_SPOTLIGHT_TOKEN }}
    limit: 6
    delay: 300
    min_views: 0
    include_forks: false
    include_archived: false
```

---

## 🔧 Required Permissions

This action uses the [GitHub REST API](https://docs.github.com/en/rest/metrics/traffic) to fetch traffic data.

You must provide a **GitHub Personal Access Token (classic)** with the following minimum scopes:

- `repo` – required to read traffic data from private and public repos

Store the token as a secret named `GH_SPOTLIGHT_TOKEN` in your repository or organization.

---

## ⚙️ Input Options

| Input             | Description                              | Default |
|------------------|------------------------------------------|---------|
| `token`          | GitHub token to authenticate API calls   | **Required** |
| `limit`          | Max number of repositories to report     | `6`     |
| `delay`          | Delay in ms between API calls            | `300`   |
| `min_views`      | Minimum views to include a repo          | `0`     |
| `include_forks`  | Include forked repositories              | `false` |
| `include_archived` | Include archived repositories          | `false` |

---

## 🧩 Example Output

```
📊 Top 6 repositories by views:
1. username/project-one — 120 views
2. username/project-two — 75 views
...
```

---

## ❓ FAQ

> **Does this change my GitHub profile or pins?**
> No — this action only reads traffic stats. It does not modify pinned repositories.

> **Can I use this for private repositories?**
> Yes — as long as your token has `repo` scope.

> **Can I run this from the command line instead of GitHub Actions?**
> Yes. You can run `node index.js`.

---

## 📄 License

MIT — maintained by [actionsforge](https://github.com/actionsforge)
