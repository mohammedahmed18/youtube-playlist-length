$("input.form-control").on("focus", (e) => {
  const label = $(e.target).parent().children().eq(1);
  label.addClass("active");
});

$("input.form-control").on("blur", (e) => {
  if (e.target.value.trim() !== "") return;
  const label = $(e.target).parent().children().eq(1);
  label.removeClass("active");
});
