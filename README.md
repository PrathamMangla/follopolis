# Follopolis: the city built by its followers

A 3D city website where every Instagram follower gets a home and every comment gives them a job.

## What's in this folder

| File | What it is |
|---|---|
| `index.html` | The website (the 3D city) |
| `admin.html` | Your daily update tool. Only you use it. |
| `js/config.js` | City name, Instagram handle, website address. **Edit this first.** |
| `js/data.js` | All the citizens. `admin.html` makes a new one each day. |
| `js/jobs.js` | Which jobs go to which building |
| `brand.html` | Makes your YouTube banner and profile picture from the real city |
| `INSTAGRAM-KIT.md` | Bio, launch posts, daily routine, captions |
| `CHANNEL-SETUP.md` | Setting up Instagram, YouTube and GitHub as Follopolis |

## Where it lives

- **Website:** https://prathammangla.github.io/follopolis/
- **Code:** https://github.com/PrathamMangla/follopolis (public; GitHub Pages serves the `main` branch)
- **Instagram:** https://instagram.com/follopolis

The city launched on Day 1 with one citizen: @follopolis, the Mayor.

## Every day

1. Open `admin.html` (double-click it) and do steps 1–5.
2. Click **Download data.js** and move it into the `js` folder, replacing the old one.
3. Publish it. Either run this in this folder:
   ```
   git commit -am "Day 2" && git push
   ```
   or on GitHub open the `js` folder → **Add file → Upload files** → drop in the new `data.js` → **Commit changes**.

The website updates within a few minutes.

The full routine (recording and posting) is in `INSTAGRAM-KIT.md`.

## Testing on your computer

`index.html` won't open by double-clicking (browsers block 3D code from local files). Run this in this folder and open http://localhost:8080:

```
python -m http.server 8080
```

`admin.html` works by double-clicking.

## Website features

- People can add a business to their job comment: `username: Baker | Luna's Bakes | @lunasbakes`. Their house gets a shop sign, the business shows next to their name, and they're listed in the **Shops** tab with a link. Featured shops (set in `admin.html`) get a gold sign and go to the top.
- Search a username or business name to fly to their house. A link like `?c=username` opens straight to them.
- Click any house to see who lives there.
- **Story card** button saves a 1080×1920 image for Instagram stories.
- Houses level up with comments: Hut → House (2) → Villa (5) → Mansion (10).
- Rare jobs: King, Queen, Wizard, Dragon tamer, Mayor. Only one person can have each.
- Day and night follow the viewer's clock (🌗 button to switch).
- 🎥 Reel mode: hides everything, shows a 9:16 frame and slowly spins the camera for screen recording. Press **R** or **Esc**.
- Animated: walking citizens, a flying dragon, a rocket that launches every minute, a windmill, a ghost, police lights and stage lights.
