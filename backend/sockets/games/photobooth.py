class PhotoboothRoom:
    def __init__(self, room_code, player1, player2, sio):
        self.room_code = room_code
        self.p1 = player1
        self.p2 = player2
        self.sio = sio

        self.phase = 'tutorial'
        self.p1_ready = False
        self.p2_ready = False
        
        self.proposed_frame = None
        self.proposed_by = None
        
        # Default fallback frame
        self.selected_frame = {
            'id': 'pink', 
            'name': 'PASTEL PINK', 
            'src': '/frames/frame-pink.png', 
            'color': '#ffb3c1'
        } 

        self.FRAME_CATALOG = {
            'pink': {'id': 'pink', 'name': 'PASTEL PINK', 'src': '/frames/frame-pink.png', 'color': '#ffb3c1'},
            'grey': {'id': 'grey', 'name': 'GREY CLASSIC', 'src': '/frames/frame-grey.png', 'color': '#8d99ae'},
            'blue': {'id': 'blue', 'name': 'OCEAN BLUE', 'src': '/frames/frame-blue.png', 'color': '#a2d2ff'},
            'red': {'id': 'red', 'name': 'CRIMSON RED', 'src': '/frames/frame-red.png', 'color': '#ff4d6d'}
        }

    def get_state(self):
        return {
            "phase": self.phase,
            "p1_ready": self.p1_ready,
            "p2_ready": self.p2_ready,
            "proposed_frame": self.proposed_frame,
            "proposed_by": self.proposed_by,
            "selected_frame": self.selected_frame
        }

    async def broadcast_state(self, extra_data=None):
        payload = self.get_state()
        if extra_data:
            payload.update(extra_data)
        await self.sio.emit('photobooth_update', payload, room=self.room_code)

    async def handle_ready(self, username):
        if username == self.p1:
            self.p1_ready = True
        elif username == self.p2:
            self.p2_ready = True

        if self.p1_ready and self.p2_ready:
            self.phase = 'frame_select'
        
        await self.broadcast_state()

    async def propose_frame(self, username, frame_id):
        frame_data = self.FRAME_CATALOG.get(frame_id)
        if frame_data:
            self.proposed_frame = frame_data
            self.proposed_by = 'p1' if username == self.p1 else 'p2'
            await self.broadcast_state()

    async def confirm_frame(self, agreed):
        if agreed and self.proposed_frame:
            self.selected_frame = self.proposed_frame
            self.phase = 'shooting'
        else:
            self.proposed_frame = None
            self.proposed_by = None
            
        await self.broadcast_state()

    async def sync_action(self, action):
        if action == 'retake_all':
            self.phase = 'shooting'
            
        await self.broadcast_state({"action": action})