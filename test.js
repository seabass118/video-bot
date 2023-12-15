const youtubedl = require("youtube-dl-exec");
const prompt = require("prompt-sync")();
const fs = require("fs");
const waitOn = require("wait-on");
const ffmpeg = require("fluent-ffmpeg");
const { totalTime } = require("./utils");
const { exec } = require("child_process");

const start = () => {
	console.log(
		"\x1b[36m%s\x1b[0m",
		`
███████╗███████╗ █████╗ ██████╗  █████╗ ███████╗███████╗    ██████╗  ██████╗ ████████╗     ██╗    ██████╗ 
██╔════╝██╔════╝██╔══██╗██╔══██╗██╔══██╗██╔════╝██╔════╝    ██╔══██╗██╔═══██╗╚══██╔══╝    ███║   ██╔═████╗
███████╗█████╗  ███████║██████╔╝███████║███████╗███████╗    ██████╔╝██║   ██║   ██║       ╚██║   ██║██╔██║
╚════██║██╔══╝  ██╔══██║██╔══██╗██╔══██║╚════██║╚════██║    ██╔══██╗██║   ██║   ██║        ██║   ████╔╝██║
███████║███████╗██║  ██║██████╔╝██║  ██║███████║███████║    ██████╔╝╚██████╔╝   ██║        ██║██╗╚██████╔╝
╚══════╝╚══════╝╚═╝  ╚═╝╚═════╝ ╚═╝  ╚═╝╚══════╝╚══════╝    ╚═════╝  ╚═════╝    ╚═╝        ╚═╝╚═╝ ╚═════╝ 
                                    https://www.github.com/seabass118
    `
	);
	return new Promise((resolve) => {
		let clip_url = prompt("Enter youtube video url: ");
		let gameplay_url = prompt("Enter gameplay url: ");
		let clipStart = prompt("Enter clip start: ");
		let clipEnd = prompt("Enter clip end: ");
		fs.mkdirSync("temp");
		resolve({
			clip_url: clip_url,
			gameplay_url: gameplay_url,
			clipStart: clipStart,
			clipEnd: clipEnd,
		});
	});
};

const downloadVideos = (clip_url, gameplay_url, clipStart, clipEnd) => {
	return new Promise((resolve) => {
		console.log("Downloading youtube videos...");
		try {
            console.log("donwloading clip...")
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
                console.log("downloading gameplay...");
				youtubedl(gameplay_url, {
					output: "temp/gameplay_clip.mp4",
					format: "mp4",
					downloader: "ffmpeg",
					downloaderArgs: `ffmpeg_i:-ss 00:00:00 -to ${totalTime(
						clipStart,
						clipEnd
					)}`,
					noCheckCertificates: true,
					noWarnings: true,
					preferFreeFormats: true,
					addHeader: ["referer:youtube.com", "user-agent:googlebot"],
				}).then(() => {
					resolve();
				})
            });
		} catch (error) {
			console.log("Error downloading video: " + error);
		}
	});
};

const scaleVideos = () => {
	return new Promise((resolve) => {
		waitOn({
			resources: ["temp/youtube_clip.mp4", "temp/gameplay_clip.mp4"],
		})
			.then(function () {
				console.log(
					`
                ------------
                Scaling clip
                ------------
                `
				);
				ffmpeg()
					.input("temp/youtube_clip.mp4")

					// Audio bit rate
					.size("?x960")

					// Output file

					// Log the percentage of work completed
					.on("progress", (progress) => {
						if (progress.percent) {
							console.log(
								`Scaling clip: ${Math.floor(
									progress.percent
								)}% done`
							);
						}
					})

					.saveToFile("temp/clip_scaled.mp4")

					.on("end", () => {
						ffmpeg()
							.input("temp/gameplay_clip.mp4")

							// Audio bit rate
							.size("?x960")

							// Output file

							// Log the percentage of work completed
							.on("progress", (progress) => {
								if (progress.percent) {
									console.log(
										`Scaling gameplay: ${Math.floor(
											progress.percent
										)}% done`
									);
								}
							})

							.saveToFile("temp/gameplay_scaled.mp4")

							// The callback that is run when FFmpeg encountered an error
							.on("end", () => {
								resolve();
							});
					})

					// The callback that is run when FFmpeg encountered an error
					.on("error", (error) => {
						console.error(error);
					});
			})
			.catch(function (err) {
				console.log("Download not built!");
			});
	});
};

const reAspect = () => {
	return new Promise((resolve) => {
		ffmpeg()
			.input("temp/clip_scaled.mp4")
			.size("1706x960")
			.output("temp/clip_new_res.mp4")
			.on("progress", (progress) => {
				if (progress.percent) {
					console.log(
						`Re-formating aspect ratio: ${Math.floor(progress.percent)}% done`
					);
				}
			})
            .on("end", function () {
                console.log("success");
                resolve();
            })
            .run();
	});
};

const stackVideos = () => {
	return new Promise((resolve) => {
		try {
			ffmpeg.ffprobe("temp/clip_scaled.mp4", function (err, metadata) {
				if (err) {
					console.error(err);
				} else {
					if (metadata.streams[0].width !== 1706) {
						reAspect().then(() => {
							ffmpeg()
								.input("temp/clip_new_res.mp4")
								.input("temp/gameplay_scaled.mp4")
								.complexFilter("vstack=inputs=2")
								.output("temp/stacked.mp4")
								.on("error", function (er) {
									console.log("error occured: " + er.message);
								})
								.on("progress", (progress) => {
									if (progress.percent) {
										console.log(
											`Stacking videos: ${Math.floor(
												progress.percent
											)}% done`
										);
									}
								})
								.on("end", function () {
									console.log("success");
									resolve();
								})
								.run();
						});
					} else {
                        ffmpeg()
								.input("temp/clip_scaled.mp4")
								.input("temp/gameplay_scaled.mp4")
								.complexFilter("vstack=inputs=2")
								.output("temp/stacked.mp4")
								.on("error", function (er) {
									console.log("error occured: " + er.message);
								})
								.on("progress", (progress) => {
									if (progress.percent) {
										console.log(
											`Stacking videos: ${Math.floor(
												progress.percent
											)}% done`
										);
									}
								})
								.on("end", function () {
									console.log("success");
									resolve();
								})
								.run();
                    }
				}
			});
		} catch (error) {}
	});
};

const cropVideo = () => {
	return new Promise((resolve) => {
		ffmpeg()
			.input("temp/stacked.mp4")
			.videoFilters("crop=1080:1920:313:1920")
			.output("temp/cropped.mp4")
			.on("error", function (er) {
				console.log("error occured: " + er.message);
			})
			.on("progress", (progress) => {
				if (progress.percent) {
					console.log(
						`Cropping video: ${Math.floor(progress.percent)}% done`
					);
				}
			})
			.on("end", function () {
				console.log("success");
				resolve();
			})
			.run();
	});
};

const generateSubtitles = () => {
	return new Promise((resolve) => {
		console.log("Generating subtitles using Whisper...");
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
		console.log("Burning subtitles...");
		exec(
			`ffmpeg -i temp/cropped.mp4 -vf subtitles=temp/subtitles.srt:fontsdir=fonts:force_style='FontName=HelveticaBQ-MediumItalic,Fontsize=24,Alignment=10' -c:v libx264 -crf 23 -c:a copy temp/cropped_with_subs.mp4`,
			(error, stdout, stderr) => {
				if (error) {
					console.warn(error);
				}
				resolve(stdout ? stdout : stderr);
			}
		);
	});
};

const addHook = () => {
	return new Promise((resolve) => {
		exec(
			`ffmpeg -i temp/cropped_with_subs.mp4 -i hooks/god-damn.mp3 -filter_complex "[1]adelay=0|0[aud];[0][aud]amix" -c:v copy done/out.mp4`,
			(error, stdout, stderr) => {
				if (error) {
					console.warn(error);
				}
				resolve(stdout ? stdout : stderr);
			}
		);
	});
};

start().then((data) => {
	Promise.all([
		downloadVideos(
			data.clip_url,
			data.gameplay_url,
			data.clipStart,
			data.clipEnd
		),
		scaleVideos()
	]).then(() => {
		console.log("Promises complete");
        stackVideos().then(() => {
            cropVideo().then(() => {
                generateSubtitles().then(() => {
                    burnSubtitles().then(() => {
                        addHook().then(() => {
                            fs.rmSync("temp", { recursive: true, force: true });
                        })
                    })
                })
            })
        })
	});
});
