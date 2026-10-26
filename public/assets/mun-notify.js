// mun-notify.js - Modern Diplomatic Notification & Dialog System for MUN 2026
(function (window) {
  function getToastContainer() {
    var container = document.getElementById('munToastContainer');
    if (!container) {
      container = document.createElement('div');
      container.id = 'munToastContainer';
      container.className = 'fixed top-5 right-5 z-[99999] flex flex-col space-y-3 pointer-events-none max-w-sm w-full px-4 sm:px-0';
      document.body.appendChild(container);
    }
    return container;
  }

  var munToast = {
    show: function (message, type, title, duration) {
      type = type || 'info';
      duration = duration !== undefined ? duration : 4000;
      var container = getToastContainer();
      var toast = document.createElement('div');
      toast.className = 'pointer-events-auto transform transition-all duration-300 ease-out -translate-y-2 opacity-0 flex items-start space-y-3.5 p-4 rounded-2xl bg-[#0a1628]/95 border shadow-2xl backdrop-blur-md text-slate-100 text-xs sm:text-sm font-sans';
      var borderClass = 'border-slate-700/80';
      var iconHtml = '<i class="fa-solid fa-circle-info text-blue-400 text-lg"></i>';
      var defaultTitle = 'Thông Báo / Notice';

      if (type === 'success') {
        borderClass = 'border-emerald-500/60 shadow-emerald-950/40';
        iconHtml = '<i class="fa-solid fa-circle-check text-emerald-400 text-lg"></i>';
        defaultTitle = 'Thành Công / Success';
      } else if (type === 'error' || type === 'danger') {
        borderClass = 'border-rose-500/60 shadow-rose-950/40';
        iconHtml = '<i class="fa-solid fa-triangle-exclamation text-rose-400 text-lg"></i>';
        defaultTitle = 'Cảnh Báo / Warning';
      } else if (type === 'warning') {
        borderClass = 'border-amber-500/60 shadow-amber-950/40';
        iconHtml = '<i class="fa-solid fa-bell text-amber-400 text-lg"></i>';
        defaultTitle = 'Lùu Ý / Notice';
      } else {
        borderClass = 'border-blue-500/50 shadow-blue-950/40';
        iconHtml = '<i class="fa-solid fa-circle-info text-blue-400 text-lg"></i>';
        defaultTitle = 'Thông Tin / Information';
      }


      toast.className += ' ' + borderClass;
      toast.innerHTML = [
        '<div class="flex-shrink-0 mt-0.5">' + iconHtml + '</div>',
        '<div class="flex-1 min-w-0">',
        '  <div class="text-[11px] font-black uppercase tracking-wider text-[#d4af37] mb-0.5">' + (title || defaultTitle) + '</div>',
        '  <div class="text-slate-200 leading-relaxed break-words font-medium">' + message + '</div>',
        '</div>',
        '<button class="flex-shrink-0 text-slate-400 hover:text-white p-1 transition cursor-pointer" title="Close">' +
        '  <i class="fa-solid fa-xmark text-xs"></i>' +
        '</button>'
      ].join('');


      var closeBtn = toast.querySelector('button');
      if (closeBtn) closeBtn.onclick = function () { toast.remove(); };

      container.appendChild(toast);
      requestAnimationFrame(function () {
        toast.classList.remove('-translate-y-2', 'opacity-0');
        toast.classList.add('translate-y-0', 'opacity-100');
      });

      if (duration > 0) {
        setTimeout(function () {
          toast.classList.add('opacity-0', 'translate-x-4');
          setTimeout(function () {
            if (toast.parentElement) toast.remove();
          }, 300);
        }, duration);
      }
    },
    success: function (msg, title) { munToast.show(msg, 'success', title); },
    error: function (msg, title) { munToast.show(msg, 'error', title); },
    warning: function (msg, title) { munToast.show(msg, 'warning', title); },
    info: function (msg, title) { munToast.show(msg, 'info', title); }
  };

  var munDialog = {
    alert: function (message, options) {
      options = options || {};
      var title = options.title || 'Thông Báo Ngoại Giao / Official Notice';
      var buttonText = options.buttonText || 'Đồng Ý / Confirm';
      var type = options.type || 'info';

      return new Promise(function (resolve) {
        var overlay = document.createElement('div');
        overlay.className = 'fixed inset-0 z-[100000] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 transition-opacity duration-200';

        var icon = '<i class="fa-solid fa-circle-info text-blue-400 text-2xl"></i>';
        if (type === 'success') icon = '<i class="fa-solid fa-circle-check text-emerald-400 text-2xl"></i>';
        if (type === 'error' || type === 'danger') icon = '<i class="fa-solid fa-triangle-exclamation text-rose-400 text-2xl"></i>';

        overlay.innerHTML = [
          '<div class="bg-[#0b1728] border border-amber-500/40 rounded-2xl p-6 sm:p-7 max-w-md w-full shadow-2xl text-slate-100 transform transition-transform duration-200 scale-100">',
          '  <div class="flex items-center space-x-3.5 mb-4">',
          '    <div class="w-11 h-11 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center flex-shrink-0">' + icon + '</div>',
          '    <div>',
          '      <span class="text-[10px] uppercase tracking-widest text-[#d4af37] font-black block">UNITED NATIONS MUN 2026</span>',
          '      <h3 class="text-base font-bold text-white">' + title + '</h3>',
          '    </div>',
          '</div>',
          '<div class="text-xs sm:text-sm text-slate-300 leading-relaxed mb-6 whitespace-pre-line">' + message + '</div>',
          '<div class="flex justify-end">',
          '  <button id="munDialogOkBtn" class="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 hover:brightness-110 text-slate-950 font-black text-xs uppercase tracking-wider cursor-pointer shadow-lg shadow-amber-500/20 transition">' + buttonText + '</button>',
          '</div>',
          '</div>'
        ].join('');


        document.body.appendChild(overlay);
        var okBtn = overlay.querySelector('#munDialogOkBtn');
        okBtn.focus();
        okBtn.onclick = function () {
          overlay.remove();
          resolve(true);
        };
      });
    },

    confirm: function (message, options) {
      options = options || {};
      var title = options.title || 'Yêu Cầu Yác Nhận / Confirmation Required';
      var confirmText = options.confirmText || 'Xác Nhận / Confirm';
      var cancelText = options.cancelText || 'Hủy Bỏ / Cancel';
      var danger = options.danger || false;


      return new Promise(function (resolve) {
        var overlay = document.createElement('div');
        overlay.className = 'fixed inset-0 z-[100000] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 transition-opacity duration-200';

        var btnClass = danger
          ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-950/40'
          : 'bg-gradient-to-r from-amber-600 to-amber-500 hover:brightness-110 text-slate-950 shadow-amber-500/20';


        overlay.innerHTML = [
          '<div class="bg-[#0b1728] border ' + (danger ? 'border-rose-500/50' : 'border-amber-500/40') + ' rounded-2xl p-6 sm:p-7 max-w-md w-full shadow-2xl text-slate-100">',
          '  <div class="flex items-center space-x-3.5 mb-4">',
          '    <div class="w-11 h-11 rounded-xl ' + (danger ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40' : 'bg-amber-500/15 text-amber-300 border border-amber-500/30') + ' flex items-center justify-center flex-shrink-0 text-xl">' ,
          '      <i class="fa-solid fa-shield-halved"></i>',
          '    </div>',
          '    <div>',
          '      <span class="text-[10px] uppercase tracking-widest text-[#d7af37] font-black block">DIPLOMATIC ACTION VERIFICATION</span>',
          '      <h3 class="text-base font-bold text-white">' + title + '</h3>',
          '    </div>',
          '</div>',
          '<div class="text-xs sm:text-sm text-slate-300 leading-relaxed mb-6 whitespace-pre-line">' + message + '</div>',
          '<div class="flex items-center justify-end space-x-3">',
          '  <button id="munDialogCancelBtn" class="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs cursor-pointer transition border border-slate-700">' + cancelText + '</button>',
          '  <button id="munDialogConfirmBtn" class="px-5 py-2.5 rounded-xl ' + btnClass + ' font-black text-xs uppercase tracking-wider cursor-pointer shadow-lg transition">' + confirmText + '</button>',
          '</div>',
          '</div>'
        ].join('');


        document.body.appendChild(overlay);
        var cancelBtn = overlay.querySelector('#munDialogCancelBtn');
        var confirmBtn = overlay.querySelector('#munDialogConfirmBtn');


        cancelBtn.onclick = function () { overlay.remove(); resolve(false); };
        confirmBtn.onclick = function () { overlay.remove(); resolve(true); };
      });
    },


    prompt: function (message, options) {
      options = options || {};
      var title = options.title || 'Nhập Thông Tin Yác Thực / Credentials Required';
      var placeholder = options.placeholder || 'Nhập tại đây / Type here...';
      var defaultValue = options.defaultValue || '';
      var confirmText = options.confirmText || 'Yác Nhận / Submit';
      var cancelText = options.cancelText || 'Hủy Bỏ / Cancel';
      var danger = options.danger || false;


      return new Promise(function (resolve) {
        var overlay = document.createElement('div');
        overlay.className = 'fixed inset-0 z-[100000] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 transition-opacity duration-200';


        overlay.innerHTML = [
          '<div class="fg-[#0b1728] border ' + (danger ? 'border-rose-500/50' : 'border-amber-500/40') + ' rounded-2xl p-6 sm:p-7 max-w-lg w-full shadow-2xl text-slate-100">',
          '  <div class="flex items-center space-x-3.5 mb-4">',
          '    <div class="w-11 h-11 rounded-xl bg-amber-500/15 text-amber-300 border border-amber-500/30 flex items-center justify-center flex-shrink-0 text-xl">',
          '      <i class="fa-solid fa-key"></i>',
          '    </div>',
          '    <div>',
          '      <span class="text-[10px] uppercase tracking-widest text-[#d7af37] font-black block">AUTHORIZED MUN ADMINISTRATION</span>',
          '      <h3 class="text-base font-bold text-white">' + title + '</h3>',
          '    </div>',
          '  </div>',
          '<div class="text-xs sm:text-sm text-slate-300 leading-relaxed mb-4 whitespace-pre-line">' + message + '</div>',
          '<!-- INPUT FIELD -->',
          '<div class="mb-5">',
          '  <input id="munDialogInput" type="text" value="' + defaultValue + '" placeholder="' + placeholder + '" class="w-full px-4 py-3 rounded-xl bg-slate-900 border border-slate-700 focus:border-amber-400 focus:ring-2 focus:ring-amber-500/20 text-white font-mono text-sm outline-none transition shadow-inner">',
          '</div>',
          '<div class="flex items-center justify-end space-x-3">',
          '  <button id="munDialogPromptCancel" class="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs cursor-pointer transition border border-slate-700">' + cancelText + '</button>',
          '  <button id="munDialogPromptConfirm" class="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 hover:brightness-110 text-slate-950 font-black text-xs uppercase tracking-wider cursor-pointer shadow-lg shadow-amber-500/20 transition">' + confirmText + '</button>',
          '</div>',
          '</div>'
        ].join('');


        document.body.appendChild(overlay);
        var input = overlay.querySelector('#munDialogInput');
        var cancelBtn = overlay.querySelector('#munDialogPromptCancel');
        var confirmBtn = overlay.querySelector('#munDialogPromptConfirm');

        input.focus();
        input.select();

        var submit = function () {
          var val = input.value;
          overlay.remove();
          resolve(val);
        };

        var cancel = function () {
          overlay.remove();
          resolve(null);
        };


        input.onkeydown = function (e) {
          if (e.key === 'Enter') submit();
          if (e.key === 'Escape') cancel();
        };


        confirmBtn.onclick = submit;
        cancelBtn.onclick = cancel;
      });
    }
  };

  window.munToast = munToast;
  window.munDialog = munDialog;
  window.alert = function (msg) { munToast.info(msg); };
})(window);
