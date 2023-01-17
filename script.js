const {
  SkyWayAuthToken,
  SkyWayContext,
  SkyWayStreamFactory,
  SkyWayRoom,
  uuidV4,
} = skyway_room;

(async () => {
  const myVideo = document.getElementById("my-video");

  const {
    audio,
    video,
  } = await SkyWayStreamFactory.createMicrophoneAudioAndCameraStream();

  video.attach(myVideo);
  await myVideo.play();

  const SBChannelAction = document.getElementById('ChannelAction');
  const TBChannelName = document.getElementById('ChannelName');
  const CBChannelAllFlag = document.getElementById('ChannelAllFlag');
  const SBMemberAction = document.getElementById('MemberAction');
  const TBMemberName = document.getElementById('MemberName');
  const CBMemberAllFlag = document.getElementById('MemberAllFlag');

  let tokenString;
  let MemberName;
  let ChannelName;
  document.getElementById('createTokenBtn').addEventListener( 'click', () => {
    if(CBChannelAllFlag.checked == true) ChannelName = '*';
    else ChannelName = TBChannelName.value;
    if(CBMemberAllFlag.checked == true) MemberName = '*';
    else MemberName = TBMemberName.value;

    const ChannelAction = SBChannelAction.value;
    const MemberAction = SBMemberAction.value;

    console.log("ChannelName:", ChannelName,"ChannelAction:", ChannelAction, "MemberName:", MemberName, "MemberAction:", MemberAction);

    const testToken = new SkyWayAuthToken({
      jti: uuidV4(),
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 600,
      scope: {
        app: {
          id: "d5935862-ee21-4fee-a5ec-8a67a1f2b051",
          turn: true,
          actions: ["read"],
          channels: [
            {
              id: ChannelName,
              name: "*",
              actions: [ChannelAction],
              members: [
                {
                  id: MemberName,
                  name: MemberName,
                  actions: [MemberAction],
                  publication: {
                    actions: ["write"],
                  },
                  subscription: {
                    actions: ["write"],
                  },
                },
              ],
              sfuBots: [
                {
                  actions: ["write"],
                  forwardings: [
                    {
                      actions: ["write"]
                    }
                  ]
                }
              ]
            },
          ],
        },
      },
    });
    tokenString = testToken.encode(
      "HPUMdUeQKTtsjOe2gm5z3UhL5ZJBfRORi5lWrhi01CM="
    );
  });

  const buttonArea = document.getElementById("button-area");
  const theirMediaArea = document.getElementById("their-media-area");
  const roomNameInput = document.getElementById("room-name");
  const myNameInput = document.getElementById("my-name");
  const myId = document.getElementById("my-id");

  document.getElementById("join").onclick = async () => {
    if (roomNameInput.value === "") return;
    if (myNameInput.value === "") return;

    const context = await SkyWayContext.Create(tokenString);

    const room = await SkyWayRoom.FindOrCreate(context, {
      type: "sfu",
      name: roomNameInput.value,
    });

    const myName = myNameInput.value;
    const me = await room.join({name: myName});

    myId.textContent = me.id;

    let audioPublication = await me.publish(audio);
    let videoPublication = await me.publish(video);

    me.onStreamUnsubscribed.add( ({subscription}) => {
      console.log('me.onStreamUnsubscrived:', subscription.subscriber.name);
      const removeObject = theirMediaArea.querySelector(`[subscriptionId="${subscription.id}"`);
      removeObject.remove();
    });

    me.onStreamSubscribed.add( ({stream, subscription}) => {
      console.log('me.onStreamSubscribed:', stream);
      console.log('me.onStreamSubscribed:', subscription);
      let newMedia;
      switch (stream.track.kind) {
        case "video":
          newMedia = document.createElement("video");
          newMedia.playsInline = true;
          newMedia.autoplay = true;
          newMedia.setAttribute('subscriptionId', subscription.id);
          break;
        case "audio":
          newMedia = document.createElement("audio");
          newMedia.controls = true;
          newMedia.autoplay = true;
          newMedia.setAttribute('subscriptionId', subscription.id);
          break;
        default:
          return;
      }
      stream.attach(newMedia);
      theirMediaArea.appendChild(newMedia);
    });
    
    me.onLeft.add( (e) => {
      console.log('me.onLeft:', e);
      Array.from(buttonArea.childNodes).forEach( removeObject => removeObject.remove());
      Array.from(theirMediaArea.childNodes).forEach( removeObject => removeObject.remove());
    });

    const LeaveMemberName = document.getElementById("leave-member-name");
    const leaveMeCB = document.getElementById("leave-me");

    document.getElementById("leave").onclick = async () => {
      let flag = 0;
      if(leaveMeCB.checked){
        me.leave();
      } else {
        room.members.forEach( member => {
          console.log(member.name);
          if(member.name === LeaveMemberName.value){
            console.log('Left ', member.name);
            room.leave(member);
            flag++;
          }
        });
        if(flag === 0) console.error('Invalid value of Leave Member Name.')
      }
    }
    document.getElementById("dispose").onclick = async () => {
      // 削除予定の機能
      room.dispose();
    }
    document.getElementById("close").onclick = async () => {
      room.close();
    }

    let videoMuteTgr = false;
    document.getElementById('video-mute').onclick = async () => {
      if(videoMuteTgr){
        //const newVideo = await SkyWayStreamFactory.createCameraVideoStream();
        //newvideo.attach(myVideo);
        //await myVideo.play();
        videoPublication = await me.publish(video);//newVideo);
        videoMuteTgr = false;
      }
      else{
        await me.unpublish(videoPublication.id);
        //videoPublication = null;
        videoMuteTgr = true;
      }
    }
    let audioMuteTgr = false;
    document.getElementById('audio-mute').onclick = async () => {
      if(audioMuteTgr){
        //const newAudio = await SkyWayStreamFactory.createMicrophoneAudioStream();
        audioPublication = await me.publish(audio);
        audioMuteTgr = false;
      }else{
        await me.unpublish(audioPublication.id);
        audioMuteTgr = true;
      }
    }


    room.publications.forEach(subscribeAndAttach);
    room.onStreamPublished.add( e => {
      console.table('room.onStreamPublicationed:', e);
      subscribeAndAttach(e.publication)
    });
    room.onStreamUnpublished.add( ({publication}) => {
      if(publication.id === videoPublication.id) return;
      if(publication.id === audioPublication.id) return;
      console.log('room.onStreamUnpublished:', publication.publisher.name);
      if (publication.publisher.side == 'local') return;
      const removeObject = document.getElementById(`ssb-${publication.id}`);
      removeObject.remove();
    });

    async function subscribeAndAttach(publication){
    // Create the Subscribing Button and Event handler when room get any Publication.
      if (publication.publisher.id === me.id) return;

      const subscribeButton = document.createElement("button");
      subscribeButton.textContent = `${publication.publisher.name}: ${publication.contentType}`;
      subscribeButton.value = 0;
      subscribeButton.id = `ssb-${publication.id}`;

      buttonArea.appendChild(subscribeButton);

      let subscription;
      subscribeButton.onclick = async () => {
        console.log(subscribeButton.value);
        if(subscribeButton.value == 0){
          result = {subscription, stream} = await me.subscribe(publication.id)
          .catch( () =>  console.log('Unexpected Error on Subscrbing.'));
          subscribeButton.value = 1;
          console.log('Subscription:', subscription);
          console.log('publication:', publication);
        } else {
          console.log('publication:', publication);
          await me.unsubscribe(subscription.id)
          .catch( () =>  console.log('Unexpected Error on Unsubscrbing.'));
          subscribeButton.value = 0;
        }
      };
    }
    
    TBProperty = document.getElementById("gInfoProperty");
    document.getElementById("getRoomInfo").addEventListener( 'click', () => {
      if(TBProperty.value == ""){
        console.error("get Room Information: Specify any property");
        return;
      }
      for (const [key, value] of Object.entries(room)) {
        if(key != TBProperty.value) continue;
        if(typeof(value) == "object") console.table(value);
        else console.log(key,value);
      }
    });
  };

})();