# Follopolis: Instagram page kit

Everything you need to set up the page and post every day.
If you pick a different name, change it in `js/config.js` too.

---

## 1. Profile setup

**Username (pick the first one that's free):**
`@follopolis` (first choice) · `@follopolis.city` · `@join.follopolis`

**Name field** (this is searchable, so put keywords in it):
`Follopolis · a city built by you`

**Bio** (fits in 150 characters):
```
🏘️ A city built by its followers
🏠 Follow → you get a home
💬 Comment a job → you start working
🏪 Add your business → free shop sign
Day 1 🔥
```
Update the day number in the bio every day. It shows the page is alive.

**Link:** your website (for example `follopolis.github.io`).

**Profile picture:** screenshot the website zoomed in on the fountain at night (press 🌗 until 🌙). The glowing windows look great as a small circle. Or use the 🏘️ logo on the orange-pink gradient.

**Account type:** switch to a *Creator* account (free) to see reel stats.

**Story highlights** (make these after the first week):
| Highlight | What goes in it |
|---|---|
| 🏠 Join | How it works: follow → home, comment → job |
| 🔍 Find you | Screen recording of searching a name on the site |
| 👑 Rare jobs | King, Queen, Wizard, Dragon tamer, Mayor, and who holds them |
| 📰 News | Votes, disasters, new buildings |
| 💛 Citizens | Reshared story cards people tag you in |

---

## 2. Launch: the first 6 posts

Before you go public, post these so new visitors see a full grid. Start the city empty (see README), add yourself as citizen #1 with the job **Mayor**, plus 5–10 friends.

1. **Day 1 · The city is founded.** Slow flyover of an empty plaza. Text: "Every follower gets a home. Will you be first?"
2. **How it works.** Carousel: Follow = home 🏠 / Comment a job = work 💬 / Comment more = bigger house 🏰 / Find yourself on the website 🔍
3. **First citizens moved in.** Zoom on each friend's house with their name.
4. **Rare jobs.** "Only ONE person can be King. First comment wins 👑"
5. **The buildings.** Quick cuts of the Wizard Tower, Dragon, Rocket, Haunted House: "Which job unlocks these? Comment to find out."
6. **Day 2 · Part 1.** Your first normal daily reel.

---

## 3. Daily routine (about 20 minutes)

1. **Collect.** Open your followers list and comments on Instagram. Copy the new usernames, and write the job comments as `username: job`. If someone mentions a business, write `username: job | Business name | @their_handle` (the handle or website is optional).
2. **Update.** Open `admin.html`: **+1 day** → paste followers → paste jobs → pick the weird job of the day → add one news line → **Download data.js**.
3. **Publish.** Upload the new `data.js` into the `js` folder on GitHub (see README). The site updates in about a minute.
4. **Record.** Open the website, press 🎥 (Reel mode) and screen-record the dashed frame for 15–30 seconds. On Windows: `Win + Alt + R` (Xbox Game Bar) or OBS. Drag the view slowly or let it auto-spin.
5. **Edit.** In CapCut: crop to 9:16, add a trending sound, add the title "Day X · Part 1".
6. **Post.** Use a caption template below and **pin your own comment**: "Comment your job 👇 I'll build it tomorrow".
7. **Reply.** Answer as many comments as you can in the first hour. Replies count as comments and help the reel spread.

---

## 4. Reel ideas (rotate these)

| Reel | Hook (first 2 seconds of text) |
|---|---|
| Daily flyover | "Day 14. 2,140 people live here now." |
| Citizen of the day | "@name, this is your house." (zoom in on a random follower) |
| Weird job of the day | "Someone commented *banana inspector*…" |
| City vote | "Volcano or beach? Comments decide 🌋🏖️" |
| Rare job claimed | "We have a KING now 👑" |
| Rocket launch | "Every 60 seconds a rocket leaves this city" (it really does, it's on the Launch Pad) |
| Dragon | "Someone became a dragon tamer. This happened." |
| Day vs night | Same spot, day → night, windows lighting up |
| Level up | "This was a hut. 10 comments later…" |
| Milestone | "1,000 citizens. Find your house (link in bio)" |
| Shop of the day | "This city has a real bakery. @lunasbakes, this one's for you 🥐" |
| Main street | Flyover of all the shop signs: "23 real businesses live in this city now" |

**Tip:** Start every reel already moving. No logo, no intro. The first frame is the most important.

---

## 5. Caption templates

**Daily**
```
Day 12 · Part 1 🏘️
🏠 Follow → you get a home
💬 Comment a job → you start working
Most-liked comment gets built tomorrow 👇
```

**Vote**
```
The city needs a new building.
🌋 Volcano or 🏖️ Beach?
Comment your pick. Most comments wins tomorrow.
```

**Weird job**
```
@max_99 asked to be a BANANA INSPECTOR 🍌
So now every banana in the city is officially inspected.
What job do you want? 👇
```

**Business call-out**
```
Got a business? 🏪
Comment your job + business name, like:
"Baker | Luna's Bakes | @lunasbakes"
You get a shop sign on your house and a spot in the city's Shops list. Free.
```

**Hashtags** (3–5 is enough):
`#follopolis #citybuilder #lowpoly #indiedev #3dart`

---

## 6. Growth rules that matter

- **Post every day, same time.** The day number only works if it never breaks.
- **Use people's names.** Showing a follower's house in a reel makes them share it, and their friends follow to get a house too.
- **Reshare every story card** people tag you in. That's free advertising.
- **Ask for one action per post.** Either comment or vote, not both.
- **Check every business before adding it.** Skip spam, scams, adult content or anything you wouldn't want next to your name. You can remove a shop sign any time in `admin.html` → Businesses.
- **Go to YouTube at 10k followers:** post the same reels as Shorts, then a long video like "I let 10,000 strangers build a city for 30 days."

---

## 7. Businesses: free promotion now, income later

**Why it grows the page:** a business owner who gets a free shop sign shares it with their own customers. Every shop is a small promoter for your city.

**How it works:**
- Anyone can add a business to their job comment: `Baker | Luna's Bakes | @lunasbakes`.
- Their house gets a coloured shop sign and their business shows next to their name in the city.
- They appear in the **Shops** tab on the website, with a link to their Instagram or website.
- People can search the website by business name.
- Their story card shows the business, so they'll post it.

**Making money from it (once you have ~5k followers):**
| Offer | What they get | Starting price idea |
|---|---|---|
| ⭐ Featured shop | Gold sign, top of the Shops list (`admin.html` → Feature) | $5–10 / month |
| Shop of the day | Their shop in a daily reel with their handle tagged | $10–25 per reel |
| Landmark | A custom building named after their business | $50+ |

Be honest in captions when a shop paid for a spot: write "#ad" or "paid partnership", which Instagram requires.
