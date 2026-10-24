# labs

Small interactive experiments, served at labs.chuckwired.com.

```sh
python3 -m http.server 8000   # then open http://localhost:8000
```

Each lab is a folder with its own `index.html`. Register it in the `LABS` array in the root `index.html` to show it on the landing page. See `CLAUDE.md` for conventions and hosting.

| Lab | Path |
| --- | --- |
| Chuck's Capes of Accomplishment | `/rs2-capes/` |
| Pipes (Windows XP screensaver) | `/windows-pipes/` |
| Happy Birthday, Mama Candy (birthday card) | `/birthday-dog/` |
| Ocean (realistic sea, WebGL2, two looks) | `/ocean/` |

## How these get made
The method is written down in [`.claude/skills/new-idea-routine/SKILL.md`](.claude/skills/new-idea-routine/SKILL.md): ideas first, three directions built side by side, honest testing, a "Behind the design" page for each lab. It's a work in progress.
