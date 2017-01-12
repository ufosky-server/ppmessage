View.$groupContent = (function() {

    function GroupContent () {
        View.PPDiv.call(this, {
            'class': elementClass
        });

        // on new message arrived
        // change this group state to unread
        Service.$pubsub.subscribe('msgArrived/group', function(topics, ppMessage) {

            var groupId = ppMessage.getBody().conversation.uuid,
                $groupContentItemView = View.$groupContentItem;
            
            $groupContentItemView.showUnread(
                groupId,
                Modal.$conversationContentGroup
                    .get( groupId )
                    .unreadCount());

            // update each group item's description when new message arrived
            $groupContentItemView.description( groupId, ppMessage.getMessageSummary() );
            $groupContentItemView.timestamp( groupId, new timeago().format( ppMessage.getBody().messageTimestamp * 1000 ) );
            
        });
    }
    extend(GroupContent, View.PPDiv);

    var elementClass = 'pp-group-content-container',
        elSelector = '.' + elementClass,

        show = function() {
            $(elSelector).removeClass( elementClass + '-leave' ).show();
            return this;
        },

        hide = function() {
            $( elSelector ).addClass( elementClass + '-leave' );
            return this;
        },

        update = function(groupInfo) {
            $( elSelector ).empty();
            var html = '';
            $.each(groupInfo, function(index, item) {                
                html += View.$groupContentItem.build(item).getHTML();
            });
            $(elSelector).append(html);
            return this;
        },

        empty = function() {
            return $(elSelector).is(':empty');
        },

        visible = function () {
            return $(elSelector).is(':visible');
        },

        build = function() {
            return new GroupContent();
        };

    ////////// API ///////////////
    
    return {
        build: build,

        show: show,
        hide: hide,
        update: update,
        focus: focus,
        empty: empty,
        visible: visible
    }
    
})();
