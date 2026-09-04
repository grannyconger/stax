# $tax Hall of Fame

The leaderboard at **https://www.coachw.club/stax/**

Students play Build Your Stax, fill out a Google Form afterward, and their
scores show up here. Written for future me, who will have forgotten all of this.

---

## The short version

**Next school year, you probably do not have to change any code at all.**

Add your new classes to the Google Form dropdown, have students play, and the
new classes appear on the site automatically with the right names.

Read the "Every year" section below and stop there. The rest of this file is
only for when something breaks.

---

## How it fits together

Four pieces, in a line. Each one hands off to the next.

```
1. Google Form          Students fill this out after the game
        |
        v
2. Google Sheet         Answers land in the "Reflections" tab
        |
        v
3. Apps Script          Code.gs reads the sheet, hands back JSON
   (the "backend")      Lives INSIDE the Sheet, not on GitHub
        |
        v
4. GitHub Pages         index.html + app.js draw the leaderboard
   (the "frontend")     Lives in github.com/grannyconger/stax
```

Think of it like a restaurant. The Sheet is the pantry, Apps Script is the
kitchen, and the website is the dining room. If food is wrong, you have to work
out which room the problem is in before you start fixing things.

**The most important thing to remember:** the backend code (`Code.gs`) is NOT
in the GitHub repo. It lives inside the Google Sheet, under
**Extensions -> Apps Script**. A copy is kept in this repo for reference only.
Editing the copy here does nothing to the live site.

---

## Where everything lives

| Thing | Where |
| --- | --- |
| The website files | `github.com/grannyconger/stax` (this repo) |
| The backend code | Inside the Google Sheet: **Extensions -> Apps Script** |
| The form answers | Google Sheet, tab named **Reflections** |
| The domain | Squarespace Domains (registrar) |
| The DNS records | Google Cloud DNS |
| The domain hookup | `github.com/grannyconger/grannyconger.github.io`, in a file called `CNAME` |

### Why there are two GitHub repos

- **`grannyconger.github.io`** is the main site. It owns the domain. It holds
  the `CNAME` file (which contains `www.coachw.club`) and a tiny homepage that
  links to `/stax`.
- **`stax`** is this project. Because it sits under the main site, GitHub
  serves it at the `/stax` path.

That is the only reason the URL is `coachw.club/stax` and not something else.
Do not put a `CNAME` file in this repo. It belongs in the other one.

### The three files in this repo

| File | What it does |
| --- | --- |
| `index.html` | The page layout, styling, tables, and pop-up windows |
| `app.js` | All the logic. Fetches data, sorts, filters, draws the tables |
| `config.js` | One line: the Apps Script web app URL to fetch from |

---

## Every year: adding new classes

### What you do

1. Open the Google Form and add the new class periods to the **Class Period**
   dropdown.
2. Name them the same way as always:
   `4B PF 2026-27 (Weaver)`
3. That is it. Have students play.

### What happens on its own

The moment the first student submits, the site works out from the name that
this is a new school year and files it correctly.

| What you type in the Form | What shows on the site |
| --- | --- |
| `4B PF 2027-28 (Weaver)` | `2028 4B` |
| `1A PF 2028-29 (Weaver)` | `2029 1A` |
| `2A MKT 2027-28` | `2028 Marketing` |

The label uses the **ending** year. So `2027-28` becomes `2028`.

It also automatically:

- Adds the new classes to the dropdown, at the top, above last year's
- Creates a new **BEST OF 2028** view
- Moves the previous year down into the history section
- Points Game Analytics and Team Scores at the new year
- Drops any old class that has no scores in it

### The one rule that matters

The class name must contain a **period like `4B`** and a **year range like
`2027-28`**. That is what the site reads.

Good: `4B PF 2027-28 (Weaver)`
Good: `2A MKT 2027-28`
Bad: `Fourth Block Fall Semester`

If a name does not have both parts, that class still shows up, but with the raw
ugly name and no season, parked at the bottom of the dropdown.

### If you want a different label

Only if the automatic name is not what you want. Open the Sheet ->
**Extensions -> Apps Script**, find the `CLASSES` list near the top, and add a
line:

```javascript
{ raw: '4B PF 2027-28 (Weaver)', label: 'Senior Seminar', season: 2028 },
```

- `raw` must match the Form dropdown **exactly**, including capitals and spaces
- `label` is what shows on the site
- `season` groups it under a BEST OF year

Then redeploy (see below).

---

## How to change the backend (Code.gs)

Do this only when changing how data is read or labelled.

1. Open the Google Sheet
2. **Extensions -> Apps Script**
3. Click into the existing file, select all, paste the new code over it

   **Do not add a second file.** Two files both defining `doGet` will fight
   each other and break the site.

4. Click **Deploy -> Manage deployments**
5. Click the **pencil icon** on the existing deployment
6. Set **Version** to **New version**
7. Click **Deploy**

**Step 6 is the one people forget.** Skipping it means your changes save but
never go live, and nothing appears to happen.

Doing **Deploy -> New deployment** instead creates a brand new URL, which
breaks the site until you paste that new URL into `config.js`. Use Manage
deployments and edit the existing one.

### Checking it worked

Open the web app URL from `config.js` in a browser. You should see raw text
starting with:

```
{"success":true,"generatedAt":"...","currentSeason":2028,"seasons":[2028,2027,...
```

Check that `currentSeason` says the year you expect.

### Data is cached for 5 minutes

The backend remembers its answer for 5 minutes so the site loads fast. After
editing the Sheet, either wait 5 minutes, or add `?refresh=1` to the end of the
web app URL to force a fresh read.

---

## How to change the website (this repo)

1. Go to `github.com/grannyconger/stax`
2. **Add file -> Upload files**
3. Drag in the changed file
4. **Commit changes**
5. Wait about 2 minutes for GitHub Pages to rebuild

**If the Upload button is greyed out**, you are signed in to the wrong GitHub
account. Check the avatar in the top right. It must say `grannyconger`.
(There is an older account that does not have access.)

**Watch the file names.** Downloads often save as `app (1).js`. Rename to
exactly `app.js` before uploading, or GitHub adds a new file instead of
replacing the old one.

### After changing app.js or index.html

Open `index.html` and find these two lines near the bottom:

```html
<script src="config.js?v=4"></script>
<script src="app.js?v=4"></script>
```

Bump both numbers (`v=4` to `v=5`). This forces browsers to load the new
version instead of a saved copy. Skipping this is why a change sometimes seems
to have no effect.

---

## The warning triangles

Some student names have a small triangle next to them. Hover over it to see
which spreadsheet row it came from.

- **Amber** means the number was typed oddly and the site reformatted it.
  Example: a student typed `342.485.98` meaning `$342,485.98`. The score still
  counts, but it is worth checking.
- **Red** means the number could not be read at all. Example: a student typed
  `it logged me out.` That row still shows, but it is left out of averages,
  rankings and charts so it cannot skew anything.

To fix one, open the Reflections tab, go to the row number in the tooltip, and
correct the value. The triangle disappears within 5 minutes.

This was added because the old version silently turned these into **$0**, and
in one case turned an ROI into **320,673%**, which pushed a student to the top
of the leaderboard by accident.

---

## When something is broken

Work through these in order. Each one rules out a section.

### The whole page is blank or says "Could not load data"

1. Open the web app URL from `config.js` directly in a browser.
   - Shows JSON starting `{"success":true` -> backend is fine, problem is the
     website files. Go to step 2.
   - Shows `{"error": ...}` -> read the message. Usually the Reflections tab
     got renamed.
   - Shows a Google sign-in page -> the deployment lost its "Anyone" access
     setting. Redeploy with **Who has access: Anyone**.
   - Page not found -> the deployment URL changed. Get the current one from
     **Deploy -> Manage deployments** and paste it into `config.js`.
2. On the site, press **F12**, click **Console**, and read the red text. Most
   often one of the two files did not upload. They are a matched pair.

### The site does not load at all, or the domain looks dead

Almost always the domain, not the code. Check in this order:

1. **Is the domain expired?** Look at Squarespace Domains. This has happened
   before, in August 2026. The site was down for a month.
2. Visit `dns.google/resolve?name=www.coachw.club&type=CNAME`.
   - `"Status":0` with `grannyconger.github.io` -> DNS is fine.
   - `"Status":3` -> the domain is not resolving. Renewal or nameservers.
3. Confirm the records are still in **Google Cloud DNS**:

   | Type | Name | Value |
   | --- | --- | --- |
   | A | `@` | `185.199.108.153` |
   | A | `@` | `185.199.109.153` |
   | A | `@` | `185.199.110.153` |
   | A | `@` | `185.199.111.153` |
   | CNAME | `www` | `grannyconger.github.io` |

4. Confirm the `CNAME` file still exists in the **`grannyconger.github.io`**
   repo and contains `www.coachw.club`. Pushing to that repo can wipe it.

**Turn on auto-renew for the domain.** That is what caused the outage.

### A class is missing from the dropdown

The dropdown only lists classes that actually have scores. No submissions means
no entry. That is on purpose, so retired classes disappear on their own.

### A class shows an ugly raw name

Its Form name is missing a period (`4B`) or a year range (`2027-28`). Either
rename it in the Form, or add a `CLASSES` entry as shown above.

### Team Scores looks empty

Normal early in the year. Team Name is optional on the Form, so until someone
fills it in there is nothing to show. The tab automatically falls back to the
most recent game that does have teams.

---

## Prompts for Claude

Paste one of these along with a copy of `Code.gs`, `app.js`, and an export of
the Sheet. Claude will not remember any of this on its own.

**Starting point, gives it the lay of the land:**

> This is my $tax Hall of Fame leaderboard at coachw.club/stax. Architecture:
> Google Form feeds a Sheet, an Apps Script web app (Code.gs) serves JSON from
> the Reflections tab, and a static GitHub Pages site (index.html + app.js +
> config.js) renders it. Code.gs lives inside the Sheet, not the repo. Class
> names and seasons are derived automatically from raw names like
> "4B PF 2027-28 (Weaver)". Read all three files before changing anything, and
> tell me what will break before you edit.

**Adding a year, if the automatic naming is not doing what you want:**

> My new classes are [paste exact Form dropdown values]. They should display as
> [what you want]. Update the CLASSES list in Code.gs and confirm the dropdown,
> Game Analytics, and Team Scores all pick them up. Do not break older years.

**Adding a feature:**

> Add [feature] to the leaderboard. Constraints: keep it a single static page
> with no build step, do not add libraries beyond Bootstrap and Chart.js which
> are already loaded, and do not put student emails in the JSON. Show me what
> changes before writing code.

**Something is broken:**

> The leaderboard is showing [describe exactly what you see]. Here are Code.gs,
> app.js, and the browser console output. Work out which of the four layers is
> at fault (Form, Sheet, Apps Script, GitHub Pages) before proposing a fix.

**Checking data quality:**

> Here is an export of the Reflections tab. Find rows where portfolio value,
> total invested, expenses or total return were typed in a format that will not
> parse cleanly, and give me a list with the row numbers so I can fix them.

**A useful habit:** ask Claude to test against a real export of the Sheet rather
than trusting that the code looks right. That is how the 48 bad numbers and the
missing Sheet12 tab were found.

---

## Things that are easy to get wrong

1. Editing `Code.gs` in this repo and expecting the site to change. The live
   copy is inside the Sheet.
2. Deploying without picking **New version**. Nothing happens.
3. Using **New deployment** instead of editing the existing one. New URL, dead
   site, until `config.js` is updated.
4. Uploading to GitHub while signed in as the old account.
5. Forgetting to bump `?v=` in `index.html`, then thinking the change failed.
6. Adding a second `.gs` file instead of replacing the contents of the first.
7. Renaming the **Reflections** tab. The backend looks for that name.
8. Letting the domain expire.

---

## Worth knowing

The web app is public and so is this repo, which means the JSON, including
**full student names**, can be read by anyone who finds the URL. That was a
deliberate choice. If that ever needs to change, the fix is a two-line edit in
`Code.gs` to publish first name plus last initial instead of the full name.

`COMP_INV` in `app.js` is `214657.66`, the computer opponent's fixed starting
investment in Build Your Stax. If the game itself ever changes that number,
this needs updating or the "vs computer" figures drift.

---

*Last updated September 2026. Current season at that time: 2027.*
