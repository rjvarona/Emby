define(["events","libraryMenu","layoutManager","loading","libraryBrowser","dom","components/categorysyncbuttons","userSettings","cardBuilder","apphost","playbackManager","mainTabsManager","scrollStyles","emby-itemscontainer","emby-button"],function(events,libraryMenu,layoutManager,loading,libraryBrowser,dom,categorysyncbuttons,userSettings,cardBuilder,appHost,playbackManager,mainTabsManager){"use strict";function getTabs(){return[{name:Globalize.translate("TabSuggestions")},{name:Globalize.translate("TabLatest")},{name:Globalize.translate("TabShows")},{name:Globalize.translate("TabUpcoming")},{name:Globalize.translate("TabGenres")},{name:Globalize.translate("TabNetworks")},{name:Globalize.translate("TabEpisodes")},{name:Globalize.translate("ButtonSearch")}]}function getDefaultTabIndex(folderId){switch(userSettings.get("landing-"+folderId)){case"latest":return 1;case"shows":return 2;case"favorites":return 0;case"genres":return 4;default:return 0}}return function(view,params){function reload(){loading.show(),loadResume(),loadNextUp()}function loadNextUp(){var query={Limit:24,Fields:"PrimaryImageAspectRatio,SeriesInfo,DateCreated,BasicSyncInfo",UserId:Dashboard.getCurrentUserId(),ImageTypeLimit:1,EnableImageTypes:"Primary,Backdrop,Thumb",EnableTotalRecordCount:!1};query.ParentId=libraryMenu.getTopParentId(),ApiClient.getNextUpEpisodes(query).then(function(result){result.Items.length?view.querySelector(".noNextUpItems").classList.add("hide"):view.querySelector(".noNextUpItems").classList.remove("hide");var container=view.querySelector("#nextUpItems"),supportsImageAnalysis=appHost.supports("imageanalysis"),cardLayout=!1;cardBuilder.buildCards(result.Items,{itemsContainer:container,preferThumb:!0,shape:"backdrop",scalable:!0,showTitle:!0,showParentTitle:!0,overlayText:!1,centerText:!cardLayout,overlayPlayButton:!0,cardLayout:cardLayout,vibrant:cardLayout&&supportsImageAnalysis}),loading.hide()})}function enableScrollX(){return!layoutManager.desktop}function getThumbShape(){return enableScrollX()?"overflowBackdrop":"backdrop"}function loadResume(){var parentId=libraryMenu.getTopParentId(),screenWidth=dom.getWindowSize().innerWidth,limit=screenWidth>=1600?5:6,options={SortBy:"DatePlayed",SortOrder:"Descending",IncludeItemTypes:"Episode",Filters:"IsResumable",Limit:limit,Recursive:!0,Fields:"PrimaryImageAspectRatio,SeriesInfo,UserData,BasicSyncInfo",ExcludeLocationTypes:"Virtual",ParentId:parentId,ImageTypeLimit:1,EnableImageTypes:"Primary,Backdrop,Thumb",EnableTotalRecordCount:!1};ApiClient.getItems(Dashboard.getCurrentUserId(),options).then(function(result){result.Items.length?view.querySelector("#resumableSection").classList.remove("hide"):view.querySelector("#resumableSection").classList.add("hide");var allowBottomPadding=!enableScrollX(),container=view.querySelector("#resumableItems"),supportsImageAnalysis=appHost.supports("imageanalysis"),cardLayout=!1;cardBuilder.buildCards(result.Items,{itemsContainer:container,preferThumb:!0,shape:getThumbShape(),scalable:!0,showTitle:!0,showParentTitle:!0,overlayText:!1,centerText:!cardLayout,overlayPlayButton:!0,allowBottomPadding:allowBottomPadding,cardLayout:cardLayout,vibrant:cardLayout&&supportsImageAnalysis})})}function onBeforeTabChange(e){preLoadTab(view,parseInt(e.detail.selectedTabIndex))}function onTabChange(e){var newIndex=parseInt(e.detail.selectedTabIndex);loadTab(view,newIndex)}function initTabs(){var tabsReplaced=mainTabsManager.setTabs(view,currentTabIndex,getTabs);if(tabsReplaced){var viewTabs=document.querySelector(".tabs-viewmenubar");viewTabs.addEventListener("beforetabchange",onBeforeTabChange),viewTabs.addEventListener("tabchange",onTabChange),libraryBrowser.configurePaperLibraryTabs(view,viewTabs,view.querySelectorAll(".pageTabContent"),[0,1,2,4,5,6]),viewTabs.triggerBeforeTabChange||viewTabs.addEventListener("ready",function(){viewTabs.triggerBeforeTabChange()})}}function getTabController(page,index,callback){var depends=[];switch(index){case 0:break;case 1:depends.push("scripts/tvlatest");break;case 2:depends.push("scripts/tvshows");break;case 3:depends.push("scripts/tvupcoming");break;case 4:depends.push("scripts/tvgenres");break;case 5:depends.push("scripts/tvstudios");break;case 6:depends.push("scripts/episodes");break;case 7:depends.push("scripts/searchtab")}require(depends,function(controllerFactory){var tabContent;0==index&&(tabContent=view.querySelector(".pageTabContent[data-index='"+index+"']"),self.tabContent=tabContent);var controller=tabControllers[index];controller||(tabContent=view.querySelector(".pageTabContent[data-index='"+index+"']"),controller=0===index?self:7===index?new controllerFactory(view,tabContent,{collectionType:"tvshows",parentId:params.topParentId}):new controllerFactory(view,params,tabContent),tabControllers[index]=controller,controller.initTab&&controller.initTab()),callback(controller)})}function preLoadTab(page,index){getTabController(page,index,function(controller){renderedTabs.indexOf(index)==-1&&controller.preRender&&controller.preRender()})}function loadTab(page,index){currentTabIndex=index,getTabController(page,index,function(controller){renderedTabs.indexOf(index)==-1&&(renderedTabs.push(index),controller.renderTab())})}function onPlaybackStop(e,state){state.NowPlayingItem&&"Video"==state.NowPlayingItem.MediaType&&(renderedTabs=[],mainTabsManager.getTabsElement().triggerTabChange())}function onWebSocketMessage(e,data){var msg=data;"UserDataChanged"===msg.MessageType&&msg.Data.UserId==Dashboard.getCurrentUserId()&&(renderedTabs=[])}var self=this,currentTabIndex=parseInt(params.tab||getDefaultTabIndex(params.topParentId));self.initTab=function(){var tabContent=self.tabContent,resumableItemsContainer=tabContent.querySelector("#resumableItems");enableScrollX()?(resumableItemsContainer.classList.add("hiddenScrollX"),resumableItemsContainer.classList.remove("vertical-wrap")):(resumableItemsContainer.classList.remove("hiddenScrollX"),resumableItemsContainer.classList.add("vertical-wrap")),categorysyncbuttons.init(tabContent)},self.renderTab=function(){reload()};var tabControllers=[],renderedTabs=[];enableScrollX()?view.querySelector("#resumableItems").classList.add("hiddenScrollX"):view.querySelector("#resumableItems").classList.remove("hiddenScrollX"),view.addEventListener("viewbeforeshow",function(e){if(initTabs(),!view.getAttribute("data-title")){var parentId=params.topParentId;parentId?ApiClient.getItem(Dashboard.getCurrentUserId(),parentId).then(function(item){view.setAttribute("data-title",item.Name),libraryMenu.setTitle(item.Name)}):(view.setAttribute("data-title",Globalize.translate("TabShows")),libraryMenu.setTitle(Globalize.translate("TabShows")))}var tabs=mainTabsManager.getTabsElement();tabs.triggerBeforeTabChange&&tabs.triggerBeforeTabChange(),events.on(playbackManager,"playbackstop",onPlaybackStop),events.on(ApiClient,"websocketmessage",onWebSocketMessage)}),view.addEventListener("viewshow",function(e){mainTabsManager.getTabsElement().triggerTabChange()}),view.addEventListener("viewbeforehide",function(e){events.off(playbackManager,"playbackstop",onPlaybackStop),events.off(ApiClient,"websocketmessage",onWebSocketMessage)}),view.addEventListener("viewdestroy",function(e){tabControllers.forEach(function(t){t.destroy&&t.destroy()})})}});