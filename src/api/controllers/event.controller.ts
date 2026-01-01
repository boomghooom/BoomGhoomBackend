import { Request, Response, NextFunction } from 'express';
import { eventService } from '../../application/services/EventService.js';
import { sendSuccess, sendCreated, sendPaginated, sendNoContent } from '../../shared/utils/response.js';
import {
  CreateEventInput,
  UpdateEventInput,
  EventFiltersInput,
  CancelEventInput,
  RejectJoinInput,
  BulkInviteInput,
} from '../validators/event.validator.js';
import { IdParamInput } from '../validators/user.validator.js';
import { DistanceUnits } from '../../shared/constants/index.js';
import { config } from '../../config/index.js';
import { EventCategory } from '../../shared/constants/index.js';

/**
 * Get default category image URL based on category
 */
const getCategoryImageUrl = (category: EventCategory): string | undefined => {
  return config.categoryImages[category] || undefined;
};

export class EventController {
  async create(
    req: Request<unknown, unknown, CreateEventInput>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      console.log("req");
      console.log("req.body", req.body);
      const { location, pricing, imageUrls, coverImageUrl, ...rest } = req.body;
      
      // Default pricing if not provided
      const defaultPricing = {
        isFree: true,
        currency: 'INR',
        includesGST: true,
        price: undefined as number | undefined,
      };
      
      // If event is paid (not free), set price to EVENTS_PRICE from config
      const finalPricing = { ...(pricing ?? defaultPricing) };
      if (finalPricing.isFree === false) {
        finalPricing.price = config.business.eventsPrice;
      }
      
      // Get default category image URL if not provided
      const categoryImageUrl = getCategoryImageUrl(rest.category);
      
      // Set default imageUrls if not provided
      const finalImageUrls = imageUrls && imageUrls.length > 0 
        ? imageUrls 
        : categoryImageUrl 
          ? [categoryImageUrl] 
          : [];
      
      // Set default coverImageUrl if not provided
      const finalCoverImageUrl = coverImageUrl || categoryImageUrl;
       
      const event = await eventService.createEvent({
        ...rest,
        adminId: req.userId!,
        location: {
          type: 'Point',
          // GeoJSON/MongoDB 2dsphere format: [longitude, latitude]
          // This follows the standard: coordinates[0] = longitude, coordinates[1] = latitude
          coordinates: [location.longitude, location.latitude],
          address: location.address,
          venueName: location.venueName,
          city: location.city,
          state: location.state,
          landmark: location.landmark,
        },
        pricing: finalPricing,
        imageUrls: finalImageUrls,
        coverImageUrl: finalCoverImageUrl,
      });
      sendCreated(res, event, 'Event created');
    } catch (error) {
      next(error);
    }
  }

  async createEventWithPublish(
    req: Request<unknown, unknown, CreateEventInput>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { location, pricing, imageUrls, coverImageUrl, ...rest } = req.body;
      
      // Default pricing if not provided
      const defaultPricing = {
        isFree: true,
        currency: 'INR',
        includesGST: true,
        price: undefined as number | undefined,
      };
      
      // If event is paid (not free), set price to EVENTS_PRICE from config
      const finalPricing = { ...(pricing ?? defaultPricing) };
      if (finalPricing.isFree === false) {
        finalPricing.price = config.business.eventsPrice;
      }
      
      // Get default category image URL if not provided
      const categoryImageUrl = getCategoryImageUrl(rest.category);
      
      // Set default imageUrls if not provided
      const finalImageUrls = imageUrls && imageUrls.length > 0 
        ? imageUrls 
        : categoryImageUrl 
          ? [categoryImageUrl] 
          : [];
      
      // Set default coverImageUrl if not provided
      const finalCoverImageUrl = coverImageUrl || categoryImageUrl;
       
      const event = await eventService.createEventWithPublish({
        ...rest,
        adminId: req.userId!,
        location: {
          type: 'Point',
          // GeoJSON/MongoDB 2dsphere format: [longitude, latitude]
          // This follows the standard: coordinates[0] = longitude, coordinates[1] = latitude
          coordinates: [location.longitude, location.latitude],
          address: location.address,
          venueName: location.venueName,
          city: location.city,
          state: location.state,
          landmark: location.landmark,
        },
        pricing: finalPricing,
        imageUrls: finalImageUrls,
        coverImageUrl: finalCoverImageUrl,
        isPublished: true,
      });
      sendCreated(res, event, 'Event created with publish');
    } catch (error) {
      next(error);
    }
  }

  async publish(
    req: Request<IdParamInput>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const event = await eventService.publishEvent(req.params.id, req.userId!);
      sendSuccess(res, event, { message: 'Event published' });
    } catch (error) {
      next(error);
    }
  }

  async getById(
    req: Request<IdParamInput>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const event = await eventService.getEventById(req.params.id);
      sendSuccess(res, event);
    } catch (error) {
      next(error);
    }
  }

  async getByDeepLink(
    req: Request<{ deepLinkId: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const event = await eventService.getEventByDeepLink(req.params.deepLinkId);
      sendSuccess(res, event);
    } catch (error) {
      next(error);
    }
  }

  async list(
    req: Request<unknown, unknown, unknown, EventFiltersInput>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { page, limit, latitude, longitude, maxDistance, city, ...filters } = req.query;

      let result;
      if (latitude && longitude) {
        result = await eventService.getNearbyEvents(
          [longitude, latitude],
          filters,
          { page, limit }
        );
      } else if (city) {
        result = await eventService.getEventsByCity(city, filters, { page, limit });
      } else if (req.user?.location?.city) {
        result = await eventService.getEventsByCity(req.user.location.city, filters, { page, limit });
      } else {
        result = await eventService.getEventsByCity('Mumbai', filters, { page, limit });
      }

      sendPaginated(res, result.data, {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
        hasNextPage: result.hasNextPage,
        hasPrevPage: result.hasPrevPage,
      });
    } catch (error) {
      next(error);
    }
  }

  async getUpcoming(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const city = req.query.city as string || req.user?.location?.city || 'Mumbai';
      const limit = parseInt(req.query.limit as string) || 10;
      const events = await eventService.getUpcomingEvents(city, limit);
      sendSuccess(res, events);
    } catch (error) {
      next(error);
    }
  }

  async getFeatured(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const city = req.query.city as string || req.user?.location?.city || 'Mumbai';
      const limit = parseInt(req.query.limit as string) || 10;
      const events = await eventService.getFeaturedEvents(city, limit);
      sendSuccess(res, events);
    } catch (error) {
      next(error);
    }
  }

  async getMyEvents(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const result = await eventService.getUserEvents(req.userId!, { page, limit });
      sendPaginated(res, result.data, {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
        hasNextPage: result.hasNextPage,
        hasPrevPage: result.hasPrevPage,
      });
    } catch (error) {
      next(error);
    }
  }

  async getCreatedEvents(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const result = await eventService.getAdminEvents(req.userId!, { page, limit });
      sendPaginated(res, result.data, {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
        hasNextPage: result.hasNextPage,
        hasPrevPage: result.hasPrevPage,
      });
    } catch (error) {
      next(error);
    }
  }

  async update(
    req: Request<IdParamInput, unknown, UpdateEventInput>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const event = await eventService.updateEvent(req.params.id, req.userId!, req.body as never);
      sendSuccess(res, event, { message: 'Event updated' });
    } catch (error) {
      next(error);
    }
  }

  async cancel(
    req: Request<IdParamInput, unknown, CancelEventInput>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const event = await eventService.cancelEvent(req.params.id, req.userId!, req.body.reason);
      sendSuccess(res, event, { message: 'Event cancelled' });
    } catch (error) {
      next(error);
    }
  }

  async complete(
    req: Request<IdParamInput>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const event = await eventService.completeEvent(req.params.id, req.userId!);
      sendSuccess(res, event, { message: 'Event completed' });
    } catch (error) {
      next(error);
    }
  }

  async join(
    req: Request<IdParamInput>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const event = await eventService.requestToJoin(req.params.id, req.userId!);
      sendSuccess(res, event, { message: 'Join request submitted' });
    } catch (error) {
      next(error);
    }
  }

  async approveJoin(
    req: Request<{ id: string; userId: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    console.log('req.params.userId',req.params)
    try {
      const event = await eventService.approveJoinRequest(
        req.params.id,
        req.userId!,
        req.params.userId
      );
      sendSuccess(res, event, { message: 'Join request approved' });
    } catch (error) {
      next(error);
    }
  }

  async rejectJoin(
    req: Request<{ id: string; userId: string }, unknown, RejectJoinInput>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const event = await eventService.rejectJoinRequest(
        req.params.id,
        req.userId!,
        req.params.userId,
        req.body.reason
      );
      sendSuccess(res, event, { message: 'Join request rejected' });
    } catch (error) {
      next(error);
    }
  }

  async requestLeave(
    req: Request<IdParamInput>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const event = await eventService.requestToLeave(req.params.id, req.userId!);
      sendSuccess(res, event, { message: 'Leave request submitted' });
    } catch (error) {
      next(error);
    }
  }

  async approveLeave(
    req: Request<{ id: string; userId: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const event = await eventService.approveLeaveRequest(
        req.params.id,
        req.userId!,
        req.params.userId
      );
      sendSuccess(res, event, { message: 'Leave request approved' });
    } catch (error) {
      next(error);
    }
  }

  async getPreviousParticipants(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const participants = await eventService.getAdminPreviousParticipants(req.userId!);
      sendSuccess(res, participants);
    } catch (error) {
      next(error);
    }
  }

  async bulkInvite(
    req: Request<IdParamInput, unknown, BulkInviteInput>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const count = await eventService.bulkInvite(
        req.params.id,
        req.userId!,
        req.body.recipientIds,
        req.body.message
      );
      sendSuccess(res, { invitesSent: count }, { message: `${count} invites sent` });
    } catch (error) {
      next(error);
    }
  }

  async recordShare(
    req: Request<IdParamInput>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      await eventService.recordShare(req.params.id);
      sendNoContent(res);
    } catch (error) {
      next(error);
    }
  }
}

export const eventController = new EventController();

