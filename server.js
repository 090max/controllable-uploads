var express = require("express");
var app = express();
var bodyParser = require("body-parser");
let path = require("path");
let fs = require("fs");

app.use(bodyParser.json());
app.use(express.static("public"));
app.use(bodyParser.urlencoded({ extended: true }));
let uploads = Object.create(null);

app.post("/upload", (req, res) => {
  let fileId = req.headers["x-file-id"];
  let startByte = +req.headers["x-start-byte"];

  if (!fileId) {
    res.writeHead(400, "No file id");
    res.end();
  }

  let filePath = path.join(__dirname + "/storage", fileId);

  console.log("Uploaded FileId : ", fileId);

  // initialize a new upload
  if (!uploads[fileId]) uploads[fileId] = {};
  let upload = uploads[fileId];

  // console.log(
  //   "BytesReceived:" + upload.bytesReceived + " startByte:" + startByte
  // );

  let fileStream;

  if (!startByte) {
    fs.writeFile(path.join(__dirname + "/storage", fileId), "", err => {
      if (err) throw err;
      console.log("The file has been saved!");
    });
    upload.bytesReceived = 0;
    fileStream = fs.createWriteStream(filePath, {
      flags: "w"
    });
    console.log("New file created: " + filePath);
  } else {
    if (upload.bytesReceived != startByte) {
      res.writeHead(400, "Wrong start byte");
      res.end(upload.bytesReceived);
      return;
    }

    // If the file already exists,append to existing file
    fileStream = fs.createWriteStream(filePath, {
      flags: "a"
    });
    console.log("File reopened: " + filePath);
  }

  req.on("data", function(chunk) {
    // console.log("bytes received", upload.bytesReceived);
    upload.bytesReceived += chunk.length;
  });

  // send request body to file
  req.pipe(fileStream);

  // when the request is finished, and all its data is written
  fileStream.on("close", function() {
    if (upload.bytesReceived == req.headers["x-file-size"]) {
      console.log("Upload finished");
      delete uploads[fileId];
      res.end("Success " + upload.bytesReceived);
    } else {
      // In case of connection lost,the unfinished file is left around
      console.log("File unfinished, stopped at " + upload.bytesReceived);
      res.end();
    }
  });

  // in case of I/O error - finish the request
  fileStream.on("error", function(err) {
    console.log("An error in filesteam");
    res.writeHead(500, "File error");
    res.end();
  });
});

//This function runs when Abort is called
//Rollbacks the work done..
app.post("/delete", (req, res) => {
  try {
    let fileId = req.body.FileId;
    console.log("Deleting ", fileId);
    if (!fileId) {
      res.writeHead(400, "No file id");
      res.end();
    }

    uploads[fileId].bytesReceived = 0;
    fs.unlink(path.join(__dirname + "/storage", fileId), function(err) {
      if (!err) console.log("Rollback Activated , File deleted!");
    });
  } catch (e) {
    console.log("No file Found to Stop");
  }
});

//This function refreshes the filesystem , thus making the upload object NULL!!
app.post("/refresh", (req, res) => {
  uploads = Object.create(null);
});

//This function is being called when the status is to be required...
//Give the info of the bytes that has been uploaded..
app.use("/status", (req, res) => {
  let fileId = req.headers["x-file-id"];

  let upload = uploads[fileId];

  console.log("onStatus fileId:", fileId, " upload:", upload);
  if (!upload) {
    res.end("0");
  } else {
    console.log("STATUS", upload.bytesReceived);
    res.end(String(upload.bytesReceived));
  }
});

app.listen("8080", () => {
  console.log("Server Listening to 8080");
});
