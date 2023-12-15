const youtubedl = require("youtube-dl-exec");
const prompt = require("prompt-sync")();
const fs = require("fs");
const ffmpeg = require("fluent-ffmpeg");
const cliProgress = require('cli-progress');
const { exec } = require("child_process");

const bar1 = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);

const config = {
    subtitles: true
}

const start = () => {
	return new Promise((resolve) => {
		let clip_url = prompt("Enter youtube video url: ");
		let clipStart = prompt("Enter clip start: ");
		let clipEnd = prompt("Enter clip end: ");
		fs.mkdirSync("temp");
		resolve({
			clip_url: clip_url,
			clipStart: clipStart,
			clipEnd: clipEnd,
		});
	});
};

const downloadVideo = (clip_url, clipStart, clipEnd) => {
	return new Promise((resolve) => {
		try {
            console.log(`
            -------------------
            Downloading clip...
            -------------------
            `)
			youtubedl(clip_url, {
				output: "temp/youtube_clip.mp4",
				format: "mp4",
				downloader: "ffmpeg",
				downloaderArgs: `ffmpeg_i:-ss ${clipStart} -to ${clipEnd}`,
				noCheckCertificates: true,
				noWarnings: true,
				preferFreeFormats: true,
				addHeader: ["referer:youtube.com", "user-agent:googlebot"],
            }).then(() => {
                resolve();
            })
		} catch (error) {
			console.log("Error downloading video: " + error);
		}
	});
};

const resize = () => {
    return new Promise((resolve) => {
        console.log(`
        --------------
        Re-sizing clip
        --------------
        `)
        bar1.start(100, 0);
        ffmpeg()
					.input("temp/youtube_clip.mp4")

					// Audio bit rate
					.size("?x960")

					// Log the percentage of work completed
					.on("progress", (progress) => {
						if (progress.percent) {
							bar1.update(progress.percent);
						}
					})

					.saveToFile("temp/clip_resized.mp4")

					// The callback that is run when FFmpeg encountered an error
					.on("error", (error) => {
						console.error(error);
					})

                    .on("end", () => {
                        bar1.stop();
						resolve();
					});
    });
}

const cropVideo = () => {
    return new Promise((resolve) => {
        console.log(`
        --------------
        Cropping Video
        --------------
        `)
        bar1.start(100, 0);
        ffmpeg()
            .input("temp/clip_resized.mp4")
            .videoFilter("crop=1080:960:(in_w-out_w)/2:(in_h-out_h)/2")
            .on("progress", (progress) => {
                if (progress.percent) {
                    bar1.update(progress.percent);
                }
            })

            .saveToFile("temp/clip_cropped.mp4")

            // The callback that is run when FFmpeg encountered an error
            .on("error", (error) => {
                console.error(error);
            })

            .on("end", () => {
                bar1.stop();
                resolve();
            });
    })
}

const addBackground = () => {
    return new Promise((resolve) => {
        console.log(`
        -----------------
        Adding Background
        -----------------
        `)
        bar1.start(100, 0);
        ffmpeg()
        .input("temp/clip_cropped.mp4")
        .videoFilters("scale=1080:1920:force_original_aspect_ratio=decrease:flags=fast_bilinear,split[original][copy];[copy]scale=72:128:force_original_aspect_ratio=increase:flags= fast_bilinear,boxblur=10:2,gblur=sigma=2,scale=1080:1920:flags=fast_bilinear[blurred];[blurred][original]overlay=(main_w-overlay_w)/2:(main_h-overlay_h)/2,setsar=1")
        .on("progress", (progress) => {
            if (progress.percent) {
                bar1.update(progress.percent);
            }
        })
        .saveToFile("temp/clip_with_background.mp4")
        .on("error", (error) => {
            console.error(error);
        })
        .on("end", () => {
            bar1.stop();
            resolve();
        });
    })
}

const generateSubtitles = () => {
	return new Promise((resolve) => {
		console.log("-- Generating subtitles using Whisper --");
        
		exec(
			`stable-ts temp/youtube_clip.mp4 -o subtitles.srt --output_dir temp --max_words 1 --suppress_tokens=0,11,13,30 --tag "<font color="#F8E36A">" "</font>"`,
			(error, stdout, stderr) => {
				console.log(stdout);
				if (error) {
					console.warn(error);
				}
				resolve(stdout ? stdout : stderr);
			}
		);
	});
};

const burnSubtitles = () => {
	return new Promise((resolve) => {
		console.log("-- Burning subtitles --");
        bar1.start(100, 0);
		ffmpeg("temp/clip_with_background.mp4")
        .outputOptions(
            "-lavfi subtitles=temp/subtitles.srt:fontsdir=fonts:force_style='FontName=HelveticaBQ-MediumItalic,Alignment=2,Fontsize=18,MarginV=50'"
        )
        .output("done/ksixspeed.mp4")
        .on("progress", (progress) => {
            if (progress.percent) {
                bar1.update(progress.percent);
            }
        })
        .on("end", function () {
          bar1.stop();
          resolve();
        })
        .on("error", function (e) {
          console.log("error: ", e.code, e.msg, e);
        })
        .run();
	});
};

start().then((data) => {
    Promise.all([
        downloadVideo(
            data.clip_url,
            data.clipStart,
            data.clipEnd
        )
    ]).then(() => {
        resize().then(() => {
            cropVideo().then(() => {
                addBackground().then(() => {
                    if(config.subtitles) {
                        generateSubtitles().then(() => {
                            burnSubtitles().then(() => {
                                fs.rmSync("temp", { recursive: true, force: true });
                            })
                        })
                    } else {
                        fs.rmSync("temp", { recursive: true, force: true });
                    }
                })
            })
        })
    });
})
