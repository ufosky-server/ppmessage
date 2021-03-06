/**
 *
 * @description: 
 *
 * 1. messageBox not visible (launcher is showing):
 *     publish('msgArrived/launcher', ppMessageJsonBody);
 *
 * 2. messageBox visible:
 *
 *     2.1 in chating panel and you are chatting with `group_id`:
 *         publish('msgArrived/chat', ppMessageJsonBody);
 *
 *     2.2 in group list panel:
 *         publish('msgArrived/group', ppMessageJsonBody);
 *
 */
Service.$messageReceiverModule = (function() {

    var PLAY_SOUND = true, // play notification sound

    	browserTabNotify,
        
        isGroupOnChatting = function ( groupUUID ) {
            return groupUUID &&
                View.$conversationContentContainer.visible() &&
                PP.isOpen() &&
                Service.$conversationManager.activeConversation() && 
                Service.$conversationManager.activeConversation().uuid === groupUUID;
        },
        
        getModal = function ( groupUUID ) {
            return Modal.$conversationContentGroup.get( groupUUID );
        },

        handleByQuickMessageMode = function( ppMessage ) {
            if ( Ctrl.$conversationQuickMessage.isEnabled() ) {
                Ctrl.$conversationQuickMessage.handleMessage( ppMessage );
                return true;
            }
            return false;
        },

        onNewMessageArrived = function(topics, ppMessage) {
            
            var $pubsub = Service.$pubsub,
                body = ppMessage.getBody(),
                groupId = body.conversation.uuid;

            if ( browserTabNotify ) { // browser tab notify
                browserTabNotify.notify( ppMessage );
            }

	        if ( PLAY_SOUND ) { // Play notification sound when new message arrived
		        Audio !== undefined && new Audio( Service.Constants.MSG_NOTIFICATION_SOUND_URL ).play();
	        }

            // Quick message
            Service.$debug.d( '[New-Message] is quick message: ', Service.$messageToolsModule.isQuickMessage( body ) );
            if ( Service.$messageToolsModule.isQuickMessage( body ) && 
                 handleByQuickMessageMode( ppMessage ) ) {
                Service.$debug.d( '[New-Message] handle by quick message mode' );
                getModal( groupId ).addMessage ( body ); // Store message to local
                return;
            }

            if ( isGroupOnChatting ( groupId ) ) { // we are chating with `converstionId`

                Service.$debug.d( '[New-Message] handle by active conversation' );
                $pubsub.publish('msgArrived/chat', ppMessage);
                
            } else {

                // store message && record unread count
                var modal = getModal ( groupId );
                modal.addMessage ( body );
                modal.incrUnreadCount();
                Ctrl.$sheetheader.incrUnread();

                // conversation list is showing
                if ( PP.isOpen() && 
                     Ctrl.$conversationPanel.mode() === Ctrl.$conversationPanel.MODE.LIST ) {
                    Service.$debug.d( '[New-Message] handle by list' );
                    $pubsub.publish('msgArrived/group', ppMessage);
                } else {
                    // launcher is showing
                    Service.$debug.d( '[New-Message] handle by launcher' );
                    $pubsub.publish('msgArrived/launcher', ppMessage);
                }
                
            }

        },

        // Start me by call this method !
        // settings: {user_uuid: xxxx, device_uuid: xxxx}
        start = function(settings) {

            if (!settings) return;

            // Initialization notification by user_uuid and device_uuid, and start it !
            Service.$notification.init({
                user_uuid: settings.user_uuid,
                device_uuid: settings.device_uuid,
                app_uuid: settings.app_uuid
            }).start();

            // listen page visibility change event
            if ( browserTabNotify )
                browserTabNotify.unregister();
            browserTabNotify = BrowserTabNotify();
            browserTabNotify.register();

            // Subscribe newMessageArrivced event
            Service.$pubsub.subscribe("ws/msg", onNewMessageArrived);
        };
    
    return {
        start: start
    };

    /////////////////////////////////////////
    //        Browser Tab Notify           //
    /////////////////////////////////////////

    //
    // https://www.w3.org/TR/page-visibility/
    //
    // @description:
    //     Let website title in browser tab change and scroll, when new message
    // arrived & page not visible.
    //
    // ```
    // var browserNotify = BrowserTabNotify();
    // browserNotify.register(); // listen `page visibility` change event
    //
    // browserNotify.notify( ppMessage ); // notify browser title to change and scroll
    // ...
    // browserNotify.unregister(); // unlisten `page visiblility` change event
    // ```
    //
    // NOTE: Only notify in PC browser 
    //
    function BrowserTabNotify() {

        var hiddenType,
            pageHidden = false,
            registered = false,
            originTitle,
            timeoutToken,
            scrollMsg,
            scrollPosition = 0;

        return {
            register: register,
            unregister: unregister,

            notify: notify
        }
        
        function register() {
            if ( registered ) return;
            
            var hidden;

            // Standards:
            if ((hidden = "hidden") in document)
                document.addEventListener("visibilitychange", onchange);
            else if ((hidden = "mozHidden") in document)
                document.addEventListener("mozvisibilitychange", onchange);
            else if ((hidden = "webkitHidden") in document)
                document.addEventListener("webkitvisibilitychange", onchange);
            else if ((hidden = "msHidden") in document)
                document.addEventListener("msvisibilitychange", onchange);

            registered = hidden !== undefined;
            hiddenType = hidden;

            originTitle = document.title;
            
        }

        function unregister() {
            if (registered) {
                if ( hiddenType === 'hidden' )
                    document.removeEventListener( 'visibilitychange', onchange );
                else if ( hiddenType === 'mozHidden' )
                    document.removeEventListener( 'mozvisibilitychange', onchange );
                else if ( hiddenType === 'webkitHidden' )
                    document.removeEventListener( 'webkitvisibilitychange', onchange );
                else if ( hiddenType === 'msHidden' )
                    document.removeEventListener( 'msvisibilitychange', onchange );
            }
            
            registered = false;
            hiddenType = undefined;

            resumeTitle();
            
        }

        function onchange( event ) {
            pageHidden = document[ hiddenType ];

            if ( !pageHidden ) {
                resumeTitle();
            }
        }

        function notify( ppMessage ) {
            if ( canNotify() ) {
                clearScroll();
                scrollMsg = buildMsgTitle( ppMessage );
                scrollTitle();
            }
        }

        function canNotify() {
            return registered &&
                hiddenType !== undefined &&
                ( !Service.$device.isMobileBrowser() ) &&
                pageHidden;
        }

        function buildMsgTitle( ppMessage ) {
            return Service.Constants.i18n( 'PPMESSAGE' ) +
                ': ' +
                ppMessage.getMessageSummary() +
                '... ';
        }

        function changeTitle( title ) {
            if ( title ) document.title = title;
        }

        function resumeTitle() {
            clearScroll();
            if ( originTitle ) {
                changeTitle( originTitle );
            }
        }

        function scrollTitle() {
            var title = scrollMsg;

            var newTitle = title.substring( scrollPosition , title.length ) + title.substring( 0, scrollPosition );
            scrollPosition++;

            changeTitle( newTitle );

            if ( scrollPosition > title.length ) scrollPosition = 0;
            
            timeoutToken = $timeout( scrollTitle, 200 );
        }

        function clearScroll() {
            if ( timeoutToken ) {
                $clearTimeout( timeoutToken );
                timeoutToken = undefined;
            }
            scrollMsg = undefined;
            scrollPosition = 0;
        }
        
    }
    
})();
