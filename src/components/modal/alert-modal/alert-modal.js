(function () {
  window.appAlert = function (titleText, msgText, isConfirm = false) {
    return new Promise((resolve) => {
      $("#alert-head").text(titleText);
      $("#alert-body").text(msgText);

      if (isConfirm) {
        $("#alert-no").show();
      } else {
        $("#alert-no").hide();
      }

      $("#alert-wrap").show();

      $("#alert-yes")
        .off("click")
        .on("click", function () {
          $("#alert-wrap").hide();
          resolve(true);
        });

      $("#alert-no")
        .off("click")
        .on("click", function () {
          $("#alert-wrap").hide();
          resolve(false);
        });
    });
  };
})();
