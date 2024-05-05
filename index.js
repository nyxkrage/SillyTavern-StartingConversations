import { callPopup, printMessages, clearChat, substituteParams, characters, default_ch_mes, eventSource, event_types, menu_type } from "../../../../script.js";
import { getContext, writeExtensionField } from "../../../extensions.js";
import { getMessageTimeStamp } from "../../../RossAscends-mods.js";
import { getRegexedString, regex_placement } from "../../../extensions/regex/engine.js";

const startingConversationButton = `
<div class="menu_button menu_button_icon open_starting_conversation margin0" title="Click to set additional starting conversation" data-i18n="[title]Click to set starting conversation">
    <span data-i18n="Starting Convo">Starting Convo.</span>
</div>
`;
const startingConversationTemplate = `
<div id="starting_conversation_template" class="template_element">
    <div class="starting_conversation flexFlowColumn flex-container">
        <div class="title_restorable">
            <h3><span data-i18n="Starting Conversation">Starting Conversation</span></h3>
            <div title="Add" class="menu_button fa-solid fa-plus add_starting_conversation" data-i18n="[title]Add"></div>
        </div>
        <small class="justifyLeft" data-i18n="Starting Conversation Subtitle">
            These will be loaded as the initial messages from the character and
            user when starting a new chat.
        </small>
        <hr>
        <div class="starting_conversation_list flexFlowColumn flex-container wide100p">
            <strong class="starting_conversation_hint margin-bot-10px" data-i18n="Starting Conversation Hint">
                Click the <i class="fa-solid fa-plus"></i> button to get started!
            </strong>
        </div>
    </div>
</div>
`;
const startingConversationFormTemplate = `
<div id="starting_conversation_form_template" class="template_element">
    <div class="starting_conversation">
        <div class="title_restorable">
            <strong>Starting Message #<span class="message_index"></span></strong>
            <div class="flex-container alignItemsBaseline">
                <label>
                    <span>Is User Message?</span>
                </label>
                <input type="checkbox" class="starting_conversation_is_user" />
                <div class="menu_button fa-solid fa-trash-alt delete_starting_conversation"></div>
            </div>
        </div>
        <textarea name="starting_conversation" data-i18n="[placeholder](This will be the first message from the character that starts every chat)" placeholder="(This will be the first message from the character that starts every chat)" class="text_pole textarea_compact starting_conversation_text maxlength="50000" value="" autocomplete="off" rows="16"></textarea>
    </div>
</div>
`;
const alternateGreetingButtonWrapper = `
<flex-container flexFlowColumn alignItemsFlexEnd></div>
`;

async function updateMessages() {
        const context = getContext()
        const this_chid = context.characterId
        // TODO: come up with a better metric than checking if the length of chat is 1
        if (characters[this_chid]?.data?.extensions?.starting_conversation
            && Array.isArray(characters[this_chid]?.data?.extensions?.starting_conversation)
            && characters[this_chid]?.data?.extensions?.starting_conversation.length > 0
            && context.chat.length === 1)
        {
            if (characters[this_chid]?.data?.alternate_greetings.length > 0) {
                toastr.warning('Character is using starting conversation, but also has alternate greetings. alternate greetings will be ignored.');
            }
            const messages = characters[this_chid].data.extensions.starting_conversation.map(message => {
                return {
                    name: message.role === 'user' ? context.name1 : context.name2,
                    is_user: message.role === 'user',
                    is_system: false,
                    send_date: getMessageTimeStamp(),
                    mes: substituteParams(getRegexedString(message.text, message.role === 'user' ? regex_placement.USER_INPUT : regex_placement.AI_OUTPUT)),
                    extra: {},
                };
            });
            context.chat.length = 0;
            context.chat.push(...messages);
            clearChat()
            printMessages()
            await getContext().saveChat();
        }
}

function init() {
    // add starting conversation button next to alt greetings button
    // get element with class open_alternate_greetings
    $('.open_alternate_greetings')
        .wrap(alternateGreetingButtonWrapper)
        .after(startingConversationButton)

    $('#alternate_greetings_template')
        .before(startingConversationTemplate)
        .before(startingConversationFormTemplate);

    eventSource.on(event_types.CHAT_CHANGED, async function() {
        const context = getContext()
        const this_chid = context.characterId
        $('.open_starting_conversation').data('chid', this_chid);
        await updateMessages();
    })

    $('#dialogue_popup_ok').click(async function (e, customData) {
        if ($('#dialogue_popup_text').children().hasClass('starting_conversation')) {
            await updateMessages();
            writeExtensionField(getContext().characterId, "starting_conversation", characters[getContext().characterId].data?.extensions?.starting_conversation)
        }
    })
    $(document).on('click', '.open_starting_conversation', openStartingConversation);
}

init();

function openStartingConversation() {
    const chid = $('.open_starting_conversation').data('chid');

    if (menu_type != 'create' && chid === undefined) {
        toastr.error('Does not have an Id for this character in editor menu.');
        return;
    } else {
        // If the character does not have a starting conversation, create an empty array
        if (chid && Array.isArray(characters[chid].data?.extensions?.starting_conversation) == false) {
            characters[chid].data.extensions.starting_conversation = [];
        }
    }

    const template = $('#starting_conversation_template .starting_conversation').clone();
    const getArray = () => menu_type == 'create' ? [] : characters[chid].data.extensions.starting_conversation;

    for (let index = 0; index < getArray().length; index++) {
        addStartingConversation(template, getArray()[index], index, getArray);
    }

    template.find('.add_starting_conversation').on('click', function () {
        const array = getArray();
        const index = array.length;
        array.push({ text: default_ch_mes, role: index % 2 == 1 ? 'user' : 'char' });
        addStartingConversation(template, array[index], index, getArray);
    });

    callPopup(template, 'text', '', { wide: true, large: true });
}

function addStartingConversation(template, message, index, getArray) {
    const messageBlock = $('#starting_conversation_form_template .starting_conversation').clone();
    messageBlock.find('.starting_conversation_text').on('input', async function () {
        const value = $(this).val();
        const array = getArray();
        array[index].text = value;
    }).val(message.text);
    messageBlock.find('.starting_conversation_is_user').on('click', async function () {
        const value = $(this).prop('checked');
        const array = getArray();
        array[index].role = value ? 'user' : 'char';
    }).prop('checked', message.role === 'user');
    messageBlock.find('.message_index').text(index + 1);
    messageBlock.find('.delete_starting_conversation').on('click', async function () {
        if (confirm('Are you sure you want to delete this starting conversation message?')) {
            const array = getArray();
            array.splice(index, 1);
            // We need to reopen the popup to update the index numbers
            openStartingConversation();
        }
    });
    template.find('.starting_conversation_list').append(messageBlock);
}
