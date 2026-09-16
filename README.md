# Football Pick Ems 2.0

This package is split into public GitHub files and private Google-side files.

## SAFE TO UPLOAD TO GITHUB

Upload these:

- `index.html`
- `config.js`
- `css/style.css`
- `js/app.js`
- `README.md`
- `.gitignore`

## DO NOT UPLOAD

Everything inside the `DO NOT UPLOAD` folder is private Google-side setup.

The private Apps Script uses:

- the Google Sheet ID
- phone numbers as private participant identifiers
- full names internally

The public API returns only:

- First Name + Last Initial
- rankings
- points
- picks
- game results/status
- weekly outcome
- weekly pot amount
- End of Season Pot amount

It does **not** return phone numbers, email addresses, timestamps, raw response objects, private IDs, or the Sheet ID.

## Current rules

### Weekly

- Each valid weekly entrant contributes `$5`.
- Weekly pot = `weekly entrants × $5`.
- A weekly payout winner must go perfect across every game in that week's Pick Em.
- If multiple entrants go perfect, they are co-winners.
- If nobody goes perfect after all games are Final, the entire weekly pot rolls into the **End of Season Pot**.

### Overall season

- Every correct finalized pick adds one point.
- Overall standings are cumulative across weeks.

### End of Season Pot

- Automatically equals the sum of weekly pots from completed weeks with no perfect winner.

## Speed design

The API is split into:

- `?action=summary`
- `?action=week&week=1`
- `?action=overall`

Apps Script caches each endpoint independently.

The browser:

- loads summary first
- loads the active week before overall standings
- keeps a local browser copy for instant stale-while-refresh display
- requests fresh data immediately afterward

## Annual setup

For the next season:

1. Copy the Google Form and Sheet.
2. Update the private `Code.gs` Sheet ID and season.
3. Deploy a new Apps Script Web App.
4. Add the new `/exec` URL to `config.js`.
5. Change `currentSeason`.

The GitHub dashboard itself does not need to be rebuilt.


## 2.1 scheduled refresh update

The backend now also rebuilds its caches four times per day, approximately at 6 AM, 12 PM, 6 PM, and 11 PM in the Apps Script project timezone. Existing form-submit and Results/Players edit refreshes remain enabled.
