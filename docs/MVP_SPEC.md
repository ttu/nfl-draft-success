# NFL Draft Retention & Role Tracker

## MVP Technical Specification

---

# 1. Objective

Build a **front-end-only**, fully static website that evaluates NFL
draft success using:

- Snap share
- Games played (availability)
- Retention status

The site must: - Support all 32 NFL teams - Show draft classes for a
configurable year range (default: 2018--2025) - Classify player roles
using snap share + availability - Calculate team-level draft success
metrics - Load all data from version-controlled JSON files - Require no
backend or database

---

# 2. Tech Stack

- Build tool: **Vite**
- Framework: **React**
- Language: TypeScript
- Hosting: Static (Vercel, Netlify, GitHub Pages)
- Data source: `/data/*.json`

All calculations are done client-side.

---

# 3. Role Classification Logic

For each season:

gamesPlayedShare = gamesPlayed / teamGames

Classification order:

1.  snapShare \>= 0.65 AND gamesPlayedShare \>= 0.5 → core_starter\
2.  snapShare \>= 0.65 AND gamesPlayedShare \< 0.5 →
    starter_when_healthy\
3.  snapShare \>= 0.35 → significant_contributor\
4.  snapShare \>= 0.1 → depth\
5.  Else → non_contributor

If multiple seasons exist: - Player's highest achieved role determines
overall classification.

---

# 4. Team Metrics

For each draft class:

- Total picks
- Core starter count
- Starter when healthy count
- Contributor count
- Retention count
- Core Starter Rate
- Contributor Rate
- Retention Rate

---

# 5. 5-Year Rolling Draft Score

Role weights:

| Role                    | Weight |
| ----------------------- | ------ |
| Core Starter            | 3      |
| Starter when healthy    | 3      |
| Significant Contributor | 2      |
| Depth                   | 1      |
| Non-Contributor         | 0      |

Score per player = highest role weight.

Team Score = (sum of player scores) / (total picks)

Display: - 5-Year Draft Score - Core Starter % - Retention %

---

# 6. Acceptance Criteria

MVP complete when:

- All 32 teams supported
- At least 6 draft years included
- Metrics compute correctly
- Static build works without backend
- Ongoing seasons handled correctly
