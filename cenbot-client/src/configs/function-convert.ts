import axios from "axios";
import * as htmlToImage from "html-to-image";

export const URI = process.env.CENBOT_API_URI || "https://cenbot.online/api/v1";

export const convertMilliseconds = (milliseconds: number) => {
  let seconds = milliseconds / 1000;
  let days = Math.floor(seconds / (24 * 3600));
  seconds %= 24 * 3600;
  const hours = Math.floor(seconds / 3600);
  seconds %= 3600;
  const minutes = Math.floor(seconds / 60);

  function renderTime(time: number, key: string) {
    return `${time + "" + key}`;
  }

  return `${renderTime(days, "d")} ${renderTime(hours, "h")} ${renderTime(
    minutes,
    "m"
  )}`;
};

export const handleExport = async (
  element: HTMLElement | null,
  snipeId: string
) => {
  if (!element || !snipeId) return;

  return await htmlToImage
    .toPng(element, { cacheBust: false })
    .then(async function (dataUrl) {
      let arr = dataUrl.split(",");
      // @ts-ignore
      const mime = arr[0].match(/:(.*?);/)[1];
      const bstr = atob(arr[arr.length - 1]);
      let n = bstr.length;
      const u8arr = new Uint8Array(n);
      while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
      }
      const file = new File([u8arr], `${snipeId}.png`, { type: mime });
      const form = new FormData();
      form.append("image", file);

      const uri = `${URI}/bot/export-snipe/${snipeId}`;
      await axios
        .post(uri, form, {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        })
        // .then(() => setLoading(false))
        .catch((error) => {
          const section = document.createElement("section");
          section.innerText = error || error.message;
          document.body.appendChild(section);
        });
    })
    .catch(function (error) {
      console.error("Xuất hình ảnh thất bại:", error);
    });
};
