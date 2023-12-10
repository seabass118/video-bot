function msToTime(duration) {
	var milliseconds = Math.floor((duration % 1000) / 100),
		seconds = Math.floor((duration / 1000) % 60),
		minutes = Math.floor((duration / (1000 * 60)) % 60),
		hours = Math.floor((duration / (1000 * 60 * 60)) % 24);

	hours = hours < 10 ? "0" + hours : hours;
	minutes = minutes < 10 ? "0" + minutes : minutes;
	seconds = seconds < 10 ? "0" + seconds : seconds;

	return hours + ":" + minutes + ":" + seconds + "." + milliseconds;
}

const totalTime = (clipStart, clipEnd) => {
	var time_start = new Date();
	var time_end = new Date();
	var value_start = clipStart.split(":");
	var value_end = clipEnd.split(":");

	time_start.setHours(value_start[0], value_start[1], value_start[2], 0);
	time_end.setHours(value_end[0], value_end[1], value_end[2], 0);

	// millisecond
    return (msToTime(time_end - time_start).substring(
        0,
        msToTime(time_end - time_start).length - 2
    ))
};

module.exports =  { totalTime }
