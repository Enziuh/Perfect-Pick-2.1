/*
  SAFE TO UPLOAD TO GITHUB.

  The Apps Script /exec URL is public by design.
  Never put phone numbers, email addresses, full participant lists,
  Google Sheet URLs, passwords, API keys, or secrets in this file.
*/

const PICKEM_CONFIG = {
  currentSeason: 2026,

  seasons: {
    2026: {
      name: "2026 Football Pick Ems",
      api: "PASTE_NEW_PICK_EMS_2_0_EXEC_URL_HERE"
    }
  },

  display: {
    showWeeklyPot: false,
    showEndOfSeasonPot: true
  }
};
