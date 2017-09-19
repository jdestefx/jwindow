$(document).on({selectstart: function(event) {
   if ($(event.target).parents().hasClass("jbutton")) return false;}
});


var jwin = new function() {
   var jwin = this;

   jwin.allWindows = [];
   jwin.activeWindow = undefined;

   jwin.construct = function() {
      $(window).resize(function() {
         jwin.repositionWindows();
      });

      $(document).on({keydown: jwin.onDocumentKeyDown});
   }

   // events
   jwin.onDocumentKeyDown = function(event) {
      if (["INPUT", "TEXTAREA"].indexOf($(event.target).prop("tagName").toUpperCase()) >-1) return;

      if (event.keyCode==27) {
         if (typeof jwin.activeWindow != "undefined") {
            if (jwin.activeWindow.hasCloseButton==false) return;

            if (jwin.activeWindow.closeButtonKills==true) {
               jwin.activeWindow.close();
            } else {
               jwin.activeWindow.hide();
            }
         }
      }
   }

   // methods
   jwin.repositionWindows = function() {
      jwin.allWindows.forEach(function(w) {
         if (w.position == "auto") w.setAutoPosition();
      });
   }

   jwin.newWindow = function(opts) {
      var newWindow = new jwin._win(opts);
      jwin.allWindows.push(newWindow);
      return newWindow;
   }

   jwin.removeWindow = function(wnd) {
      // if (wnd.closeButtonKills==true) {
         wnd.body.remove();
         jwin.allWindows.remove(jwin.allWindows.indexOf(wnd));
      // } else {
      //    wnd.body.hide();
      // }
   }

   jwin.bringWindowToTop = function(w) {
      var sortedWindows = jwin.allWindows.sort( function(a,b) {
         return utils.compareString(a.body.css("z-index"), b.body.css("z-index"));
      });

      for (var i=0; i<sortedWindows.length; i++) {
         sortedWindows[i].body.css("z-index", i);
      }

      w.body.css("z-index", i+1);
   }

   jwin.makeActiveWindow = function(wnd) {
      if (typeof jwin.activeWindow != "undefined") jwin.activeWindow.body.toggleClass("active", false);
      wnd.body.toggleClass("active", true);
      jwin.bringWindowToTop(wnd);
      jwin.activeWindow = wnd;
   }

   // children
   this._win = function(opts) {
      var w = this;

      w.allButtons = [];

      $.extend(this, {
         closeButtonKills: false,
         name: utils.getRandomString(16),
         canHoldFocus: true,
         title: "A Window",
         titleAlignment: "left",
         //buttons: [{"text": "Button", "onClick": $.noop}],
         buttons: [],
         controls: [], // the buttons in the top right (in the titlebar)
         centeredButtons: true,
         hasCloseButton: true,
         hasTitleBar: true,
         width:"200",
         height:"200",
         position: "any",
         onShowReady: $.noop,
         addClass: undefined,
         autoOpen: true,
         onOpen: $.noop,
         onClose: $.noop,
         resizable: false,
         onDragStop: $.noop,
         savePosition: false,
         restoreSize: true,
         minHeight: 20,
      }, opts);

      w.storedPosition = undefined;
      w.showing = false;
      w.fetchingStoredPosition = false;
      w.showWhenDoneFetching = false;

      w.construct = function() {
         w.body = system.parts.integrate.apply(w, ["parts[for=window]"]);
         if (typeof w.addClass != "undefined") w.body.toggleClass(w.addClass, true);

         if (w.hasTitleBar==true) {
            w.setTitle(w.title);
            w.setTitleAlignment(w.titleAlignment);
         } else {
            w.body.toggleClass("no-titlebar", true);
            w.divTitlebar.hide();
         }

         w.setButtons();
         w.setControls();
         w.setResizable();

         w.body.css({"visibility": "hidden"});
         w.body.appendTo(document.body);
         w.divBody.css({"width": w.width, "height": w.height});
         w.body.css({"position":"absolute"});

         var finish = function() {
            if (w.restoreSize==true) w.divBody.css({"width": w.width, "height": w.height});
            
            if (w.position != "auto") {
               w.setPosition(w.position.x, w.position.y);
            } else {
               w.setAutoPosition();
            }

            if (w.centeredButtons==true) w.divButtonArea.toggleClass("centered", true);

            if (w.autoOpen==true || w.showWhenDoneFetching==true) w.show();

            // this needs to stay last because it puts position:relative on the element which messes up positioning
            w.setupDraggable();
         }



         if (w.savePosition==true) {
            w.getStoredPosition(finish);
         } else {
            finish();
         }
      }

      w.setResizable = function() {
         if (w.resizable==false) return;

         w.body.resizable({
            alsoResize: w.divBody,
            handles: "n, s, w, e, sw, se, nw, ne",
            stop: function () {
               if (w.savePosition==true) w.savePositionToLocalStorage();
               w.onDragStop(event);
            }
         });
      }

      w.setTitle = function(newTitle) {
         w.title = newTitle;
         w.divTitle.text(newTitle);
      }

      w.setTitleAlignment = function(alignment) {
         if (alignment=="left") w.divTitlebar.toggleClass("centered", false);
         if (alignment=="center") w.divTitlebar.toggleClass("centered", true);
      }

      w.getStoredPosition = function(callback) {
         var windowName = "jwindow.windowPosition."+w.name;

         w.fetchingStoredPosition = true;
         
         chrome.storage.local.get([windowName], function(res) {
            w.fetchingStoredPosition = false;
            var res = res[windowName];

            if (res!=undefined) {
               w.position = {
                  x: res.left,
                  y: res.top,
               };

               w.width = res.width;
               w.height = res.height;
            }

            callback();
         });
      }

      w.setupDraggable = function() {
         var handle = (w.hasTitleBar==true?w.divTitlebar:w.divBody);

         w.body.draggable({
            handle: handle,
            start: function() {
               jwin.bringWindowToTop(w);
            },
            stop: function(event) {
               if (w.savePosition==true) w.savePositionToLocalStorage()
               w.onDragStop(event);
            }
         });

         w.body.on({"mousedown": function(event) {
            w.activate();
         }});
      }

      w.savePositionToLocalStorage = function() {

         var item = {["jwindow.windowPosition."+w.name]: w.getPosition()};

         chrome.storage.local.set(item);
      }

      w.setControls = function() {
         if (w.hasCloseButton==false) w.divBtnClose.hide();
         w.divBtnClose.on({"click": w.close});
      }

      w.setButtons = function() {
         if (w.buttons.length==0) {
            w.divButtonArea.hide();
            return;
         }

         w.buttons.forEach(function(buttonOpts) {
            var newBtn = new w._button(buttonOpts);
            w.allButtons.push(newBtn);
         });
      }

      w.setAutoPosition = function() {
         w.body.css({"left": (window.innerWidth/2) - w.body.width()/2});
         w.body.css({"top": (window.innerHeight/2) - w.body.height()/2});
      }

      w.setPosition = function(x,y) {
         console.log("settings pos", x, y);

         w.body.css({"position":"absolute"});
         if (typeof x == "undefined") x = 1;
         if (typeof y == "undefined") y = 1;
         w.body.css({"top": y, "left": x});
      }

      w.setSize = function(height, width) {
         //w.body.css({"width": width+"px", "height": height+"px"});
         w.divBody.css({"width": width+"px", "height": height+"px"});
      }

      w.getPosition = function() {
         var offset = w.body.offset();

         return {
            "top": offset.top,
            "left": offset.left,
            "width": w.divBody.width(),
            "height": w.divBody.height()
         };
      }

      w.activate = function() {
         if (w.canHoldFocus==true) {
            jwin.makeActiveWindow(w);
         } else {
            jwin.bringWindowToTop(w);
         }
      }

      w.show = function() {
         if (w.fetchingStoredPosition==true) {
            w.showWhenDoneFetching = true;
            return;
         } 

         if (w.position=="auto") w.setAutoPosition();

         w.body.css({"visibility":""});

         w.body.show();

         w.showing = true;

         w.activate();

         w.onOpen();

         return w;
      }

      w.hide = function() {
         w.showing = false;
         w.body.hide();
      }

      w.die = function() {
         jwin.removeWindow(w);
      }

      w.close = function() {
         if (w.onClose()!=false) {
            w.showing = false;
            jwin.removeWindow(w);
         }
         return true;
      }

      w._button = function(opts) {
         var btn = this;

         $.extend(this, {
            text: "no-text-provited",
            onClick: $.noop
         }, opts);

         btn.construct = function() {
            btn.body = system.parts.integrate.apply(btn, ["parts[for=window-button]"]);
            //btn.body.on({"click": btn.onClicked});

            btn.setText();
            btn.divButtonText.text(btn.text);
            btn.body.appendTo(w.divButtonArea);
         }

         btn.onClicked = function(event) {
            btn.onClick(event,w);
         }

         btn.setText = function(newText) {
            if (typeof newText == "undefined") newText = btn.text;
            btn.text = newText;
            btn.divButtonText.text(newText);
         }

         btn.construct();
         return this;
      }


      w.construct();
      return this;
   }

   jwin.construct();

}

if (typeof addons == "undefined") addons = {};

addons.tabNav = function(opts) {
   var tn = this;

   $.extend(this, {
      container: undefined,
      tabs: []
   }, opts);

   tn.allTabs = [];
   tn.activeTab = null;

   tn.construct = function() {
      tn.body = system.parts.integrate.apply(tn, ["[for=tab-nav] [for=tab-control]"]);
      tn.body.appendTo(tn.container);

      if (tn.makeTabs.length>0) tn.makeTabs(tn.tabs)
   }

   tn.getTabByName = function(tabName) {
      for (var i=0;i<tn.allTabs.length;i++) {
         if (tn.allTabs[i].name==tabName) return tn.allTabs[i];
      }

      return null;
   }

   tn.makeTab = function(opts) {
      var newTab = new tn._tab(opts);
      tn.allTabs.push(newTab);

      tn.checkActiveTab();

      return newTab;
   }

   tn.makeTabs = function(tabs) {
      tabs.forEach(function(t) {
         tn.makeTab(t);
      });
   }

   tn.checkActiveTab = function() {
      if (tn.allTabs.length>0 && tn.activeTab == null) {
         console.log("activate");
         tn.activateTab(tn.allTabs[0]);
      }
   }

   tn.activateTab = function(tab) {
      console.log("Activate", tab);
      if (tn.activeTab != null) tn.deactivateActiveTab();
      tn.activeTab = tab;
      tab.divTab.toggleClass("active", true);
      tab.divContent.show();
   }

   tn.deactivateActiveTab = function() {
      tn.activeTab.divTab.toggleClass("active", false);
      tn.activeTab.divContent.hide();
      tn.activeTab = null;
   }


   tn._tab = function(opts) {
      var t = this;

      $.extend(this, {
         title: "no-title",
         onTabShown: $.noop,
         name: utils.getRandomString(8)
      }, opts);

      t.construct = function() {
         t.body = system.parts.integrate.apply(t, ["[for=tab-nav] [for=tab]"]);
         t.body.toggleClass(t.name, true);
         t.divTab.appendTo(tn.divTabHolder);

         t.divTitle.text(t.title);

         t.divContent.appendTo(tn.divContent);
         t.divContent.hide();

      }

      t.onDivTabClicked = function(event) {
         tn.activateTab(t);
         t.onTabShown(t);
      }

      t.construct();
      return this;

   }

   tn.construct();
   return this;
}
