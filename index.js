const { exec } = require("child_process");
const { totalTime } = require("./utils");
const fs = require("fs");
const youtubedl = require('youtube-dl-exec')
const prompt = require('prompt-sync')();

const config = {
    subtitles: true
}

const start = () => {
    console.log('\x1b[36m%s\x1b[0m', `
███████╗███████╗ █████╗ ██████╗  █████╗ ███████╗███████╗    ██████╗  ██████╗ ████████╗     ██╗    ██████╗ 
██╔════╝██╔════╝██╔══██╗██╔══██╗██╔══██╗██╔════╝██╔════╝    ██╔══██╗██╔═══██╗╚══██╔══╝    ███║   ██╔═████╗
███████╗█████╗  ███████║██████╔╝███████║███████╗███████╗    ██████╔╝██║   ██║   ██║       ╚██║   ██║██╔██║
╚════██║██╔══╝  ██╔══██║██╔══██╗██╔══██║╚════██║╚════██║    ██╔══██╗██║   ██║   ██║        ██║   ████╔╝██║
███████║███████╗██║  ██║██████╔╝██║  ██║███████║███████║    ██████╔╝╚██████╔╝   ██║        ██║██╗╚██████╔╝
╚══════╝╚══════╝╚═╝  ╚═╝╚═════╝ ╚═╝  ╚═╝╚══════╝╚══════╝    ╚═════╝  ╚═════╝    ╚═╝        ╚═╝╚═╝ ╚═════╝ 
                                    https://www.github.com/seabass118
    `);
    return new Promise((resolve) => {
        let url = prompt('Enter youtube video url: ');
        let clipStart = prompt("Enter clip start: ");
        let clipEnd = prompt("Enter clip end: ");
        let outputName = prompt("Enter output name: ");
        fs.mkdirSync("temp");
        resolve({ url: url, clipStart: clipStart, clipEnd: clipEnd, outputName: outputName });
    });
}

const downloadVideo = (url, clipStart, clipEnd) => {
    return new Promise((resolve) => {
        console.log("Downloading youtube video...");
        try {
           youtubedl(url , {
                output: "temp/youtube_clip.mp4",
                format: "mp4",
                downloader: "ffmpeg",
                downloaderArgs: `ffmpeg_i:-ss ${clipStart} -to ${clipEnd}`,
                noCheckCertificates: true,
                noWarnings: true,
                preferFreeFormats: true,
                addHeader: ['referer:youtube.com', 'user-agent:googlebot']
            }).then(resolve())
        } catch (error) {
            console.log("Error downloading video: " + error);
        }
    })
};

const trimGameplay = (clipStart, clipEnd) => {
    return new Promise((resolve) => {
        console.log("Trimming gameplay...");
        exec(`ffmpeg -ss 00:00:00 -to ${totalTime(clipStart, clipEnd)} -i gameplay.mp4 -c copy temp/gameplay_clip.mp4`, (error, stdout, stderr) => {
            if (error) {
             console.warn(error);
            }
            resolve(stdout? stdout : stderr);
        });
    });
}

const generateSubtitles = () => {
    return new Promise((resolve) => {
        if(config.subtitles) {
            console.log("Generating subtitles using Whisper...")
            exec(`stable-ts temp/youtube_clip.mp4 -o subtitles.srt --output_dir temp --max_words 1 --suppress_tokens=0,11,13,30 --tag "<font color="#F8E36A">" "</font>"`, (error, stdout, stderr) => {
                console.log(stdout);
                if (error) {
                    console.warn(error);
                }
                resolve(stdout? stdout : stderr);
            })
        } else {
            resolve();
        }
    })
}

const burnSubtitles = () => {
    return new Promise((resolve) => {
        if(config.subtitles) {
            console.log("Burning subtitles...");
            exec(`ffmpeg -i temp/gameplay_clip_scaled.mp4 -vf subtitles=temp/subtitles.srt:fontsdir=fonts:force_style='FontName=HelveticaBQ-MediumItalic,Fontsize=32,Alignment=6' -c:v libx264 -crf 23 -c:a copy temp/gameplay_with_subs.mp4`, (error, stdout, stderr) => {
                if (error) {
                 console.warn(error);
                }
                resolve(stdout? stdout : stderr);
            });
        } else {
            resolve();
        }
    })
}


const scaleClip = () => {
    return new Promise((resolve) => {
        console.log("Scaling clip...");
        exec("ffmpeg -i temp/youtube_clip.mp4 -filter:v scale='trunc(oh*a/2)*2:960' -c:a copy temp/download_clip_scaled.mp4", (error, stdout, stderr) => {
            if (error) {
             console.warn(error);
            }
            resolve(stdout? stdout : stderr);
        });
    })
}

const scaleGameplay = () => {
    return new Promise((resolve) => {
        console.log("Scaling gameplay...");
        exec("ffmpeg -i temp/gameplay_clip.mp4 -filter:v scale='trunc(oh*a/2)*2:960' -c:a copy temp/gameplay_clip_scaled.mp4", (error, stdout, stderr) => {
            if (error) {
             console.warn(error);
            }
            resolve(stdout? stdout : stderr);
        });
    })
}

const stackVideos = () => {
    const gameplayPath = config.subtitles ? "temp/gameplay_with_subs.mp4" : "temp/gameplay_clip_scaled.mp4";
    return new Promise((resolve) => {
        console.log("Stacking videos...");
        exec(`ffmpeg -i temp/download_clip_scaled.mp4 -i ${gameplayPath} -filter_complex vstack=inputs=2 temp/stacked.mp4`, (error, stdout, stderr) => {
            if (error) {
             console.warn(error);
            }
            resolve(stdout? stdout : stderr);
        });
    })
}

const cropVideo = (outputName) => {
    return new Promise((resolve) => {
        console.log("Cropping video for TikTok...");
        exec(`ffmpeg -i temp/stacked.mp4 -filter:v crop='1080:1920:313:1920' -c:a copy temp/${outputName}.mp4`, (error, stdout, stderr) => {
            if (error) {
             console.warn(error);
            }
            resolve(stdout? stdout : stderr);
        });
    })
}

const addOverlay = (outputName) => {
    console.log("Adding trademark...");
    return new Promise((resolve) => {
        exec(`ffmpeg -i temp/${outputName}.mp4 -i datashark.png -filter_complex "[0:v][1:v] overlay=10:900:enable='between(t,0,20)'" -pix_fmt yuv420p -c:a copy done/${outputName}.mp4`, (error, stdout, stderr) => {
            if (error) {
             console.warn(error);
            }
            resolve(stdout? stdout : stderr);
        });
    })
}

start().then((data) => {
    downloadVideo(data.url, data.clipStart, data.clipEnd).then(() => {
        trimGameplay(data.clipStart, data.clipEnd).then(() => {
            scaleClip().then(() => {
                scaleGameplay().then(() => {
                    generateSubtitles().then(() => {
                        burnSubtitles().then(() => {
                            stackVideos().then(() => {
                                cropVideo(data.outputName).then(() => {
                                    addOverlay(data.outputName).then(() => {
                                        fs.rmSync("temp", { recursive: true, force: true });
                                    })
                                })
                            })
                        })
                    })
                })
            })
        })
    })
});

// Perfomance upgrades

