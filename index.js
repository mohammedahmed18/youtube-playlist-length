const express = require("express");
const ejs = require("ejs");
const axios = require("axios");
require("dotenv").config();

const app = express();
app.set("view-engine", "ejs");
app.use(express.json());
app.use(express.static("public"));
app.use(express.urlencoded({ extended: true }));

app.get("/", (req, res) => {
  res.render("index.ejs");
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
  return `https://www.googleapis.com/youtube/v3/playlistItems?key=${process.env.API_KEY}&part=contentDetails&playlistId=${playlist_id}&maxResults=50${pageToken}`;
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
  const videos = [];
  let video_ids = "";
  items.forEach((video) => {
    video_ids += `${video.contentDetails.videoId},`;
  });
  const url = getUrlVideo({ video_id: video_ids });
  const response = await axios.get(url);
  return response.data.items;
};

const getTotalLength = (videos) => {
  let h = 0;
  let m = 0;
  let s = 0;

  videos.forEach((v) => {
    const videoLength = parseLength(v.contentDetails.duration);
    h += videoLength.h;
    m += videoLength.m;
    if (m > 60) {
      h += 1;
      m -= 60;
    }
    s += videoLength.s;
    if (s > 60) {
      m += 1;
      s -= 60;
    }
  });
  const total = `${h} hours ,${m} minutes,${s} seconds`;
  return total;
};
const parseLength = (duration) => {
  // PT3H5M21S
  let h = 0;
  let m = 0;
  let s = 0;

  let subStr = "";
  for (let i = 0; i < duration.length; i++) {
    const c = duration[i];
    if (c >= "0" && c <= "9") {
      // it is a number
      subStr += c;
    } else {
      // it isn't
      if (subStr != "") {
        switch (c) {
          case "H":
            h = Number(subStr);
            break;

          case "M":
            m = Number(subStr);
            break;

          case "S":
            s = Number(subStr);
            break;
        }
        subStr = "";
      }
    }
  }

  return {
    h,
    m,
    s,
  };
};

app.post("/", async (req, res) => {
  const { playlist_link } = req.body;
  const parsed_link = stringIsAValidUrl(playlist_link);
  if (!parsed_link)
    return res.render("index.ejs", { error: "the playlist link is invalid" });

  const list_id = parsed_link.searchParams.get("list");
  if (!list_id)
    return res.render("index.ejs", { error: "the playlist link is invalid" });

  // valid list id
  //   search the list
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
    if (items.length > 50) {
      return res.render("index.ejs", {
        error: "the playlist is too large.... coming soon",
      });
    }
    const videos = await getVideosInfo(items);
    // calculate total length
    const totalLength = await getTotalLength(videos);
    return res.render("index.ejs", { totalLength });
  } catch (err) {
    console.log(err);
  }
});
const port = process.env.PORT || 5000;
app.listen(port, () => {
  console.log(`server is running now on port ${port}...`);
});
