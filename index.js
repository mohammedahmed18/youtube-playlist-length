const express = require("express");
const axios = require("axios");
require("ejs");
const app = express();
app.set("view-engine", "ejs");
app.use(express.json());
app.use(express.static("public"));
app.use(express.urlencoded({ extended: true }));
require("dotenv").config();

app.get("/", (req, res) => {
  res.render("index");
});

app.get("/hello", (req, res) => {
  res.send("hi , this works");
});

const stringIsAValidUrl = (s) => {
  try {
    const parsed_link = new URL(s);
    return parsed_link;
  } catch (err) {
    return false;
  }
};
const getUrlPlaylist = ({ playlist_id, nextPageToken }) => {
  const pageToken = nextPageToken ? `&pageToken=${nextPageToken}` : "";
  return `https://www.googleapis.com/youtube/v3/playlistItems?key=${process.env.API_KEY}&part=contentDetails,snippet&playlistId=${playlist_id}&maxResults=50${pageToken}`;
};

const getUrlVideo = ({ video_id }) => {
  return `https://www.googleapis.com/youtube/v3/videos?key=${process.env.API_KEY}&part=contentDetails&id=${video_id}`;
};

const getAllListItems = async (playlist_id, nextPageToken, current_list) => {
  try {
    const url = getUrlPlaylist({ playlist_id, nextPageToken });
    const response = await axios.get(url);
    let items = [...current_list, ...response.data.items];
    if (response.data.nextPageToken) {
      return getAllListItems(playlist_id, response.data.nextPageToken, items);
    } else {
      return items;
    }
  } catch (err) {
    console.log(err.message);
  }
};

const getVideosInfo = async (items) => {
  const perRequest = 49;
  const numberOfLoops = Math.ceil(items.length / perRequest);
  let videos_data = [];
  for (let i = 0; i < numberOfLoops; i++) {
    const videos = items.slice(i * perRequest, i * perRequest + perRequest);
    let video_ids = "";
    videos.forEach((video) => {
      video_ids += `${video.contentDetails.videoId},`;
    });
    const url = getUrlVideo({ video_id: video_ids });
    const response = await axios.get(url);
    videos_data = [...videos_data, ...response.data.items];
  }
  return videos_data;
};

const getTotalLength = (videos) => {
  let th = 0,
    tm = 0,
    ts = 0;
  videos.forEach((v) => {
    const { H, M, S } = parseLength(v.contentDetails.duration);
    th += H;
    tm += M;
    if (tm > 60) {
      th += 1;
      tm -= 60;
    }
    ts += S;
    if (ts > 60) {
      tm += 1;
      ts -= 60;
    }
  });
  return `${th} hours ,${tm} minutes,${ts} seconds`;
};
const parseLength = (duration) => {
  // PT3H5M21S
  const video_len = { H: 0, M: 0, S: 0 };
  let subStr = "";
  for (let i = 0; i < duration.length; i++) {
    const c = duration[i];
    if (c >= "0" && c <= "9") {
      // it is a number
      subStr += c;
    } else {
      // it isn't
      if (subStr != "") {
        video_len[c] = Number(subStr);
        subStr = "";
      }
    }
  }
  return video_len;
};

app.post("/", async (req, res) => {
  const { playlist_link } = req.body;
  const parsed_link = stringIsAValidUrl(playlist_link);
  const list_id = parsed_link?.searchParams?.get("list");

  if (!list_id)
    return res.render("index.ejs", { error: "the playlist link is invalid" });
  // valid list id
  try {
    const response = await axios.get(getUrlPlaylist({ playlist_id: list_id }));

    let items = response.data.items;
    if (response.data.nextPageToken) {
      // there is more items in the list
      items = await getAllListItems(
        list_id,
        response.data.nextPageToken,
        items
      );
    }
    if (items.length > 500) {
      return res.render("index.ejs", {
        error: "the playlist is too large.... limit : 500 video",
      });
    }
    const thumbnail = items[0].snippet.thumbnails.maxres.url;
    const videos = await getVideosInfo(items);
    // calculate total length
    const totalLength = await getTotalLength(videos);
    return res.render("index.ejs", { totalLength, thumbnail });
  } catch (err) {
    if (err.response.status == 404) {
      return res.render("index.ejs", {
        error:
          "the playlist cannot be found , make sure the playlist is public and try again",
      });
    }
  }
});
const port = process.env.PORT || 5000;
app.listen(port, () => {
  console.log(`server is running now on port ${port}...`);
});
