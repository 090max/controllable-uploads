//The uploader class that sends request to the server..
class Uploader {
  constructor({ file, onProgress }) {
    this.file = file; //getting the file object
    this.onProgress = onProgress; //getting the progress bytes...
    this.paused_byte = 0; //The paused_byte, when the upload has been paused..
    this.total_byte = 0; //The total_bytes of the file..
    this.fileId = file.name + "-" + file.size + "-" + file.lastModified; //Making a unique file id ...
  }

  //Returns the uploadesBytes
  async getUploadedBytes() {
    let response = await fetch("status", {
      headers: {
        "X-File-Id": this.fileId
      }
    });

    if (response.status != 200) {
      throw new Error("error to get uploaded bytes: " + response.statusText);
    }

    let text = await response.text();

    return +text;
  }

  //the process that synchronizez upload calls
  async upload() {
    this.startByte = await this.getUploadedBytes();

    let xhr = (this.xhr = new XMLHttpRequest());
    xhr.open("POST", "upload", true);

    // send file id, so that the server knows which file to resume
    xhr.setRequestHeader("X-File-Id", this.fileId);
    // send the byte we're resuming from, so the server knows we're resuming
    xhr.setRequestHeader("X-Start-Byte", this.startByte);

    xhr.setRequestHeader("X-File-Size", this.file.size);

    xhr.upload.onprogress = e => {
      this.onProgress(this.startByte + e.loaded, this.startByte + e.total);
      this.paused_byte = this.startByte + e.loaded;
      this.total_byte = this.startByte + e.total;
    };

    console.log("send the file, starting from", this.startByte);
    xhr.send(this.file.slice(this.startByte));

    return await new Promise((resolve, reject) => {
      xhr.onload = xhr.onerror = () => {
        console.log(
          "upload end status:" + xhr.status + " text:" + xhr.statusText
        );

        if (xhr.status == 200) {
          resolve(true);
        } else {
          reject(new Error("Upload failed: " + xhr.statusText));
        }
      };
      // onabort triggers only when xhr.abort() is called
      xhr.onabort = () => resolve(false);
    });
  }

  //To pause the process
  stop() {
    if (this.xhr) {
      this.onProgress(this.paused_byte, this.total_byte);
      this.xhr.abort();
    }
  }

  //To abort the process
  delete() {
    this.stop();
    log("Aborted");
    let temp_xhr = new XMLHttpRequest();

    temp_xhr.open("POST", "delete", true);
    temp_xhr.onload = function(data) {
      console.log("loaded", this.responseText);
    };
    temp_xhr.setRequestHeader("Content-Type", "application/json");

    // temp_xhr.setRequestHeader("X-File-Id", this.fileId);
    let obj = { FileId: this.fileId };
    // console.log(obj);
    temp_xhr.send(JSON.stringify(obj));
    this.startByte = 0;
    this.xhr.setRequestHeader("X-Start-Byte", this.startByte);
  }

  //To refresh the file system
  refresh() {
    let temp_xhr = new XMLHttpRequest();
    temp_xhr.open("POST", "refresh", true);
    temp_xhr.send();
  }
}
