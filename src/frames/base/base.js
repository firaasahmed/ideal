const { ipcRenderer } = require("electron");

$(".min-btn").on("click", () => ipcRenderer.send("window-minimize"));
$(".max-btn").on("click", () => ipcRenderer.send("window-maximize"));
$(".close-btn").on("click", () => ipcRenderer.send("window-close"));

$("#lock-btn").on("click", function () {
  const $body = $("body");
  $body.toggleClass("locked");
  if ($body.hasClass("locked")) {
    $(this).text("Show Navbar").attr("title", "Unlock POS");
  } else {
    $(this).text("Kiosk Mode").attr("title", "Lock POS");
  }
});

$(document).ready(function () {
  $("#nav-container").load("components/top-nav/top-nav.html", function () {
    $(".nav-btn:not(.disabled-nav)").on("click", function () {
      $(".nav-btn").removeClass("active");
      $(this).addClass("active");

      const targetHtml = $(this).data("target");
      const targetJs = $(this).data("script");
      const targetCss = $(this).data("style");

      $("#page-css").attr("href", targetCss);
      $("#page-view")
        .empty()
        .load(targetHtml, function () {
          if (targetJs) $.getScript(targetJs);
        });
    });
  });

  $("#page-css").attr("href", "frames/pos/pos.css");
  $("#page-view").load("frames/pos/pos.html", function () {
    $.getScript("frames/pos/pos.js");
  });
});
